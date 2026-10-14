"""Account registry and offline administration in the application database."""

import argparse
import getpass
import hashlib
import hmac
import re
import secrets
import sys
import time
from pathlib import Path

from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from trainer import job_lifecycle, site_settings
from trainer.config import Settings
from trainer.db import database, immediate_transaction
from trainer.errors import Conflict, DomainError, InvalidInput, NotFound
from trainer.models import AuthSession, Base, User

USERS, SESSIONS = User.__table__, AuthSession.__table__
# The reserved workspace that single-user installs and migrated data belong to.
LOCAL_USERNAME = "__local__"
SIGNUPS_OPEN = "signups_open"

COOKIE = "fieldwork_session"
SESSION_SECONDS = 30 * 24 * 3600
BUSY = (
    "The database is busy. If Fieldwork was just started or updated, it is still "
    "upgrading the database: wait until the site loads, then run this again."
)


def username(value):
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9_-]{3,32}", value):
        raise InvalidInput("Username must contain 3–32 letters, numbers, underscores or hyphens.")
    return value


def password_hash(password, salt=None):
    if not 10 <= len(password) <= 128:
        raise InvalidInput("Use a password between 10 and 128 characters.")
    salt = salt or secrets.token_hex(16)
    key = hashlib.scrypt(
        password.encode(),
        salt=bytes.fromhex(salt),
        n=131072,
        r=8,
        p=1,
        maxmem=256 * 1024 * 1024,
    )
    return f"scrypt:{salt}:{key.hex()}"


def password_matches(password, stored):
    try:
        return hmac.compare_digest(password_hash(password, stored.split(":")[1]), stored)
    except (ValueError, IndexError):
        return False


def token_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def csrf_token(token):
    return token_hash("fieldwork-csrf:" + token)


class Accounts:
    """Credentials, sessions and account administration, on the application's database.

    The only module that writes ``users`` and ``auth_sessions``. It uses the shared
    SQLAlchemy engine (and its connection setup) through Core statements on the
    mapped tables, so a schema change reaches it with the models.
    """

    def __init__(self, path: Path, engine=None):
        self.path = Path(path).resolve()
        # Standalone (the account CLI, tools) it opens a connection per call, as before.
        self.engine = engine if engine is not None else database(self.path, pooled=False)[0]

    def _row(self, statement):
        with self.engine.connect() as db:
            row = db.execute(statement).mappings().first()
        return dict(row) if row else None

    def create(self, name, password, *, admin=False, temporary=False):
        """Add an account; a ``temporary`` password must be replaced at first sign-in."""
        name = username(name)
        encoded = password_hash(password)
        try:
            with self.engine.begin() as db:
                db.execute(
                    insert(USERS).values(
                        id=secrets.token_hex(16),
                        username=name,
                        password=encoded,
                        admin=admin,
                        disabled=False,
                        chesscom_username="",
                        onboarding_completed=False,
                        password_change_required=temporary,
                        created=time.time(),
                    )
                )
        except IntegrityError as exc:
            raise InvalidInput("That username is unavailable.") from exc
        return self.by_name(name)

    def signups_open(self):
        """Whether visitors may create their own accounts; closed unless an administrator opens it."""
        return bool(site_settings.flag(self.engine, SIGNUPS_OPEN))

    def set_signups_open(self, value):
        site_settings.store(self.engine, SIGNUPS_OPEN, bool(value))

    def by_name(self, name):
        return self._row(select(USERS).where(USERS.c.username == name.strip().lower()))

    def by_id(self, user_id):
        return self._row(select(USERS).where(USERS.c.id == user_id))

    def issue(self, user_id):
        token = secrets.token_urlsafe(32)
        with self.engine.begin() as db:
            db.execute(delete(SESSIONS).where(SESSIONS.c.expires < time.time()))
            db.execute(
                insert(SESSIONS).values(
                    digest=token_hash(token), user_id=user_id, expires=time.time() + SESSION_SECONDS
                )
            )
        return token

    def resolve(self, token):
        return self._row(
            select(USERS)
            .join(SESSIONS, SESSIONS.c.user_id == USERS.c.id)
            .where(
                SESSIONS.c.digest == token_hash(token),
                SESSIONS.c.expires > time.time(),
                USERS.c.disabled.is_(False),
            )
        )

    def revoke(self, token):
        with self.engine.begin() as db:
            db.execute(delete(SESSIONS).where(SESSIONS.c.digest == token_hash(token)))

    def sign_out_everywhere(self, user_id):
        with self.engine.begin() as db:
            db.execute(delete(SESSIONS).where(SESSIONS.c.user_id == user_id))

    def complete_onboarding(self, user_id):
        with self.engine.begin() as db:
            db.execute(update(USERS).where(USERS.c.id == user_id).values(onboarding_completed=True))

    def listing(self):
        """Every account that can sign in, oldest first; the unclaimed workspace is hidden."""
        with self.engine.connect() as db:
            rows = db.execute(
                select(
                    USERS.c.id, USERS.c.username, USERS.c.admin, USERS.c.disabled, USERS.c.created
                )
                .where(USERS.c.username != LOCAL_USERNAME)
                .order_by(USERS.c.created, USERS.c.username)
            ).mappings()
            return [dict(row) for row in rows]

    def promote(self, user):
        if user["admin"]:
            raise InvalidInput("Account is already an administrator")
        # Requests re-read the account row, so existing sessions gain admin at once.
        with self.engine.begin() as db:
            db.execute(update(USERS).where(USERS.c.id == user["id"]).values(admin=True))

    def claim_local(self, name, password):
        """Give the reserved local workspace a name and password, as its administrator."""
        with self.engine.begin() as db:
            current = db.scalar(select(USERS.c.username).where(USERS.c.id == "local"))
            if current != LOCAL_USERNAME:
                raise InvalidInput("Existing local workspace has already been claimed")
            db.execute(
                update(USERS)
                .where(USERS.c.id == "local")
                .values(
                    username=username(name),
                    password=password_hash(password),
                    admin=True,
                    disabled=False,
                )
            )

    def set_password(self, user, password, *, temporary=False, keep_session=None):
        """Replace the password and sign the account out, except ``keep_session``.

        A temporary password (an administrator's reset) must be replaced at the
        next sign-in; choosing one's own password clears that requirement.
        """
        encoded = password_hash(password)
        with self.engine.begin() as db:
            db.execute(
                update(USERS)
                .where(USERS.c.id == user["id"])
                .values(password=encoded, password_change_required=temporary)
            )
            db.execute(
                delete(SESSIONS).where(
                    SESSIONS.c.user_id == user["id"],
                    SESSIONS.c.digest != (token_hash(keep_session) if keep_session else ""),
                )
            )

    def set_disabled(self, user, disabled):
        with self.engine.begin() as db:
            db.execute(update(USERS).where(USERS.c.id == user["id"]).values(disabled=disabled))
            if not disabled:
                # The scheduler skips disabled owners, so work interrupted
                # while the account was disabled is never recovered otherwise.
                job_lifecycle.recover_interrupted(db, user["id"])
            db.execute(delete(SESSIONS).where(SESSIONS.c.user_id == user["id"]))

    def delete(self, user):
        """Remove an account with every row it owns; shared caches stay."""
        if user["id"] == "local":
            raise InvalidInput(
                "The original workspace account cannot be deleted; disable it instead"
            )
        # Take the write lock before checking, so no job is claimed meanwhile. Owned
        # rows reference each other, so foreign keys are checked once, at commit.
        with immediate_transaction(self.engine, defer_foreign_keys=True) as db:
            if job_lifecycle.has_running(db, user["id"]):
                raise Conflict(
                    "This account has analysis running. Disable it, wait for the analysis "
                    "to stop, then delete it"
                )
            for table in Base.metadata.sorted_tables:
                if table is not USERS and "user_id" in table.c:
                    db.execute(delete(table).where(table.c.user_id == user["id"]))
            db.execute(delete(USERS).where(USERS.c.id == user["id"]))

    @staticmethod
    def public(user):
        return {
            key: user[key]
            for key in (
                "id",
                "username",
                "admin",
                "chesscom_username",
                "onboarding_completed",
                "password_change_required",
            )
        }


def new_password():
    # Without a terminal (docker exec without -it), getpass waits for input nobody can type.
    if not sys.stdin.isatty():
        raise InvalidInput(
            "This command asks for a password. Run it from a terminal; in Docker, use docker exec -it"
        )
    password = getpass.getpass("New password: ")
    if password != getpass.getpass("Confirm password: "):
        raise InvalidInput("Passwords do not match")
    return password


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=[
            "create-admin",
            "promote",
            "reset-password",
            "disable",
            "enable",
            "claim-local",
            "open-signups",
            "close-signups",
        ],
    )
    parser.add_argument("username", nargs="?")
    args = parser.parse_args()
    signups = args.action in {"open-signups", "close-signups"}
    if not signups and not args.username:
        parser.error(f"{args.action} needs a username")
    from sqlalchemy.exc import OperationalError

    from trainer.db import database, migrate, migrations_pending

    settings = Settings()
    engine, _ = database(settings.database_path)
    try:
        # The server upgrades the database when it starts, so this only runs on a
        # database no server has reached yet: a first setup, or a stopped server.
        if migrations_pending(engine):
            print("Upgrading the database first...", file=sys.stderr, flush=True)
            migrate(engine)
    except OperationalError as exc:
        if "locked" not in str(exc):
            raise
        parser.exit(1, f"Account error: {BUSY}\n")
    finally:
        engine.dispose()
    accounts = Accounts(settings.database_path)
    if signups:
        accounts.set_signups_open(args.action == "open-signups")
        print("Sign-ups are " + ("open" if args.action == "open-signups" else "closed"))
        return
    try:
        user = accounts.by_name(username(args.username))
        if user and user["username"] == LOCAL_USERNAME:
            # The unclaimed workspace is not an account; claim-local assigns it.
            user = None
        if args.action in {"create-admin", "claim-local"}:
            if user:
                raise InvalidInput("Account already exists")
            password = new_password()
            if args.action == "claim-local":
                accounts.claim_local(args.username, password)
            else:
                accounts.create(args.username, password, admin=True)
        else:
            if not user:
                raise NotFound("Account not found")
            if args.action == "promote":
                accounts.promote(user)
            elif args.action == "reset-password":
                accounts.set_password(user, new_password())
            else:
                accounts.set_disabled(user, args.action == "disable")
        print(f"{args.action} completed for {args.username}")
    except (DomainError, ValueError, SQLAlchemyError) as exc:
        parser.exit(1, f"Account error: {BUSY if 'locked' in str(exc) else exc}\n")


if __name__ == "__main__":
    main()
