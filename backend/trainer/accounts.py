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

    @staticmethod
    def public(user):
        return {
            key: user[key]
            for key in ("id", "username", "admin", "chesscom_username", "onboarding_completed")
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "action", choices=["create-admin", "reset-password", "disable", "enable", "claim-local"]
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
            with accounts.connect() as db:
                if args.action == "reset-password":
                    password = getpass.getpass("New password: ")
                    if password != getpass.getpass("Confirm password: "):
                        raise ValueError("Passwords do not match")
                    db.execute(
                        "UPDATE users SET password=? WHERE id=?",
                        (password_hash(password), user["id"]),
                    )
                else:
                    db.execute(
                        "UPDATE users SET disabled=? WHERE id=?",
                        (int(args.action == "disable"), user["id"]),
                    )
                db.execute("DELETE FROM auth_sessions WHERE user_id=?", (user["id"],))
        print(f"{args.action} completed for {args.username}")
    except (ValueError, sqlite3.Error) as exc:
        parser.exit(1, f"Account error: {exc}\n")


if __name__ == "__main__":
    main()
