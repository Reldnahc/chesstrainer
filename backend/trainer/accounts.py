"""Account registry and offline administration in the application database."""

import argparse
import getpass
import hashlib
import hmac
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from trainer.config import Settings

COOKIE = "fieldwork_session"
SESSION_SECONDS = 30 * 24 * 3600


def username(value):
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9_-]{3,32}", value):
        raise ValueError("Username must contain 3–32 letters, numbers, underscores or hyphens.")
    return value


def password_hash(password, salt=None):
    if not 10 <= len(password) <= 128:
        raise ValueError("Use a password between 10 and 128 characters.")
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
    def __init__(self, path: Path):
        self.path = path.resolve()

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, name, password, *, admin=False):
        name = username(name)
        encoded = password_hash(password)
        identity = secrets.token_hex(16)
        with self.connect() as db:
            try:
                db.execute(
                    "INSERT INTO users(id,username,password,admin,created,disabled,chesscom_username,onboarding_completed) VALUES(?,?,?,?,?,0,'',0)",
                    (identity, name, encoded, int(admin), time.time()),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError("That username is unavailable.") from exc
        return self.by_name(name)

    def by_name(self, name):
        with self.connect() as db:
            row = db.execute(
                "SELECT * FROM users WHERE username=?", (name.strip().lower(),)
            ).fetchone()
            return dict(row) if row else None

    def issue(self, user_id):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE expires < ?", (time.time(),))
            db.execute(
                "INSERT INTO auth_sessions VALUES(?,?,?)",
                (token_hash(token), user_id, time.time() + SESSION_SECONDS),
            )
        return token

    def resolve(self, token):
        with self.connect() as db:
            row = db.execute(
                """SELECT users.* FROM users JOIN auth_sessions ON users.id=auth_sessions.user_id
                WHERE digest=? AND expires>? AND disabled=0""",
                (token_hash(token), time.time()),
            ).fetchone()
            return dict(row) if row else None

    def revoke(self, token):
        with self.connect() as db:
            db.execute("DELETE FROM auth_sessions WHERE digest=?", (token_hash(token),))

    def listing(self):
        """Every account that can sign in, oldest first; the unclaimed workspace is hidden."""
        with self.connect() as db:
            rows = db.execute(
                "SELECT id, username, admin, disabled, created FROM users "
                "WHERE username != '__local__' ORDER BY created, username"
            ).fetchall()
            return [dict(row) for row in rows]

    def by_id(self, user_id):
        with self.connect() as db:
            row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
            return dict(row) if row else None

    def promote(self, user):
        if user["admin"]:
            raise ValueError("Account is already an administrator")
        # Requests re-read the account row, so existing sessions gain admin at once.
        with self.connect() as db:
            db.execute("UPDATE users SET admin=1 WHERE id=?", (user["id"],))

    def set_password(self, user, password, *, temporary=False, keep_session=None):
        """Replace the password and sign the account out, except ``keep_session``.

        A temporary password (an administrator's reset) must be replaced at the
        next sign-in; choosing one's own password clears that requirement.
        """
        encoded = password_hash(password)
        with self.connect() as db:
            db.execute(
                "UPDATE users SET password=?, password_change_required=? WHERE id=?",
                (encoded, int(temporary), user["id"]),
            )
            db.execute(
                "DELETE FROM auth_sessions WHERE user_id=? AND digest!=?",
                (user["id"], token_hash(keep_session) if keep_session else ""),
            )

    def set_disabled(self, user, disabled):
        with self.connect() as db:
            db.execute("UPDATE users SET disabled=? WHERE id=?", (int(disabled), user["id"]))
            if not disabled:
                # The scheduler skips disabled owners, so work interrupted
                # while the account was disabled is never recovered otherwise.
                db.execute(
                    "UPDATE analysis_jobs SET status='queued' WHERE user_id=? AND status='running'",
                    (user["id"],),
                )
            db.execute("DELETE FROM auth_sessions WHERE user_id=?", (user["id"],))

    def delete(self, user):
        """Remove an account with every row it owns; shared caches stay."""
        if user["id"] == "local":
            raise ValueError("The original workspace account cannot be deleted; disable it instead")
        with self.connect() as db:
            # Take the write lock before checking, so no job is claimed meanwhile.
            # Owned rows reference each other, so check foreign keys once at commit;
            # the pragma lasts only for an open transaction.
            db.execute("BEGIN IMMEDIATE")
            db.execute("PRAGMA defer_foreign_keys=ON")
            running = db.execute(
                "SELECT 1 FROM analysis_jobs WHERE user_id=? AND status='running'", (user["id"],)
            ).fetchone()
            if running:
                raise ValueError(
                    "This account has analysis running. Disable it, wait for the analysis "
                    "to stop, then delete it"
                )
            tables = [
                row[0]
                for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' "
                    "AND name NOT LIKE 'sqlite_%' AND name != 'users'"
                )
            ]
            for table in tables:
                columns = {column[1] for column in db.execute(f'PRAGMA table_info("{table}")')}
                if "user_id" in columns:
                    db.execute(f'DELETE FROM "{table}" WHERE user_id=?', (user["id"],))
            db.execute("DELETE FROM users WHERE id=?", (user["id"],))

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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action",
        choices=["create-admin", "promote", "reset-password", "disable", "enable", "claim-local"],
    )
    parser.add_argument("username")
    args = parser.parse_args()
    from trainer.db import database, migrate

    settings = Settings()
    engine, _ = database(settings.database_path)
    migrate(engine)
    engine.dispose()
    accounts = Accounts(settings.database_path)
    try:
        user = accounts.by_name(username(args.username))
        if user and user["username"] == "__local__":
            # The unclaimed workspace is not an account; claim-local assigns it.
            user = None
        if args.action in {"create-admin", "claim-local"}:
            if user:
                raise ValueError("Account already exists")
            password = getpass.getpass("New password: ")
            if password != getpass.getpass("Confirm password: "):
                raise ValueError("Passwords do not match")
            if args.action == "claim-local":
                with accounts.connect() as db:
                    row = db.execute("SELECT username FROM users WHERE id='local'").fetchone()
                    if not row or row[0] != "__local__":
                        raise ValueError("Existing local workspace has already been claimed")
                    db.execute(
                        "UPDATE users SET username=?, password=?, admin=1, disabled=0 WHERE id='local'",
                        (username(args.username), password_hash(password)),
                    )
            else:
                accounts.create(args.username, password, admin=True)
        else:
            if not user:
                raise ValueError("Account not found")
            if args.action == "promote":
                accounts.promote(user)
            elif args.action == "reset-password":
                password = getpass.getpass("New password: ")
                if password != getpass.getpass("Confirm password: "):
                    raise ValueError("Passwords do not match")
                accounts.set_password(user, password)
            else:
                accounts.set_disabled(user, args.action == "disable")
        print(f"{args.action} completed for {args.username}")
    except (ValueError, sqlite3.Error) as exc:
        parser.exit(1, f"Account error: {exc}\n")


if __name__ == "__main__":
    main()
