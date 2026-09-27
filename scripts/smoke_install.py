"""Smoke-test a built image using disposable containers and anonymous data volumes.

Run: python scripts/smoke_install.py --image fieldwork:install-check
HTTPS account requests simulate TLS termination using the configured public Origin;
this verifies backend proxy behavior and cookie flags, not a real TLS proxy.
"""

import argparse
import json
import subprocess
import time
import uuid

import httpx


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    args = parser.parse_args()
    containers = []
    try:
        for mode in ("local", "accounts"):
            name = f"fieldwork-install-{mode}-{uuid.uuid4().hex[:10]}"
            command = ["run", "-d", "--name", name, "--init", "-p", "127.0.0.1::8000"]
            if mode == "accounts":
                command += ["-e", "PUBLIC_ORIGIN=https://chess.example.test"]
            docker(*command, args.image)
            containers.append(name)
            port = docker("port", name, "8000/tcp").split(":")[-1]
            address = f"http://127.0.0.1:{port}"
            with httpx.Client(base_url=address, timeout=10) as client:
                deadline = time.monotonic() + 45
                while True:
                    try:
                        identity = client.get("/api/auth/me")
                        identity.raise_for_status()
                        break
                    except httpx.HTTPError:
                        if time.monotonic() >= deadline:
                            raise RuntimeError(docker("logs", name)) from None
                        time.sleep(0.5)
                assert client.get("/").status_code == 200
                assert identity.json()["enabled"] == (mode == "accounts")
                headers = {}
                if mode == "accounts":
                    assert client.get("/api/games").status_code == 401
                    payload = {"username": "install-test", "password": uuid.uuid4().hex}
                    bad = client.post("/api/auth/signup", json=payload, headers={"Origin": address})
                    assert bad.status_code == 403 and "PUBLIC_ORIGIN" in bad.text
                    signup = client.post(
                        "/api/auth/signup",
                        json=payload,
                        headers={"Origin": "https://chess.example.test"},
                    )
                    assert signup.status_code == 201, signup.text
                    assert "secure" in signup.headers["set-cookie"].lower()
                    # Emulate the Cookie header forwarded by a TLS-terminating proxy.
                    headers["Cookie"] = signup.headers["set-cookie"].split(";", 1)[0]
                    headers["Origin"] = "https://chess.example.test"
                    headers["X-CSRF-Token"] = signup.json()["csrf"]
                    assert (
                        client.get("/api/auth/me", headers=headers).json()["user"]["username"]
                        == "install-test"
                    )
                assert client.get("/api/games", headers=headers).json()["total"] == 0
                assert client.get("/api/preferences/coach", headers=headers).json() == {
                    "coach_id": "classic",
                    "motion": "natural",
                }
                preference = {"coach_id": "cat-black", "motion": "still"}
                client.put(
                    "/api/preferences/coach", headers=headers, json=preference
                ).raise_for_status()
                health = client.get("/api/health", headers=headers).json()
                assert health["engine_status"] == ("unchecked" if mode == "accounts" else "ready")
                assert health["engine_available"] is (None if mode == "accounts" else True)
                docker("restart", name)
                # Docker may allocate a different ephemeral host port on restart.
                port = docker("port", name, "8000/tcp").split(":")[-1]
                client.base_url = f"http://127.0.0.1:{port}"
                deadline = time.monotonic() + 30
                while True:
                    try:
                        response = client.get("/api/auth/me", headers=headers)
                        response.raise_for_status()
                        break
                    except httpx.HTTPError:
                        if time.monotonic() >= deadline:
                            raise RuntimeError(docker("logs", name)) from None
                        time.sleep(0.5)
                if mode == "accounts":
                    assert response.json()["user"]["username"] == "install-test"
                assert client.get("/api/preferences/coach", headers=headers).json() == preference
                assert (
                    docker(
                        "exec",
                        name,
                        "python",
                        "-c",
                        "import os; assert os.path.isfile('/data/trainer.sqlite3'); print('persistent database ok')",
                    )
                    == "persistent database ok"
                )
                # Exercise the application's native worker path and lazy pool, not
                # just the presence of a separately launched Stockfish binary.
                pgn = '[White "InstallTest"]\n[Black "FixtureOpponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1'
                imported = client.post(
                    "/api/imports",
                    files={"file": ("install-fixture.pgn", pgn)},
                    data={"side": "white", "analyze": "false"},
                    headers=headers,
                )
                assert imported.status_code == 200, imported.text
                game = client.get("/api/games", headers=headers).json()["items"][0]
                started = client.post(f"/api/games/{game['id']}/review", json={}, headers=headers)
                assert started.status_code == 200, started.text
                deadline = time.monotonic() + 45
                while True:
                    progress = client.get(f"/api/games/{game['id']}/review", headers=headers).json()
                    assert progress["job"]["status"] != "failed", progress["job"]
                    if progress["job"]["status"] == "completed":
                        assert progress["job"]["completed"] == 4
                        break
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Native game review did not complete")
                    time.sleep(0.25)
                health = client.get("/api/health", headers=headers).json()
                assert health["engine_status"] == "ready" and health["engine_available"] is True
                assert "stockfish" in health["engine_version"].lower()
                print(
                    json.dumps(
                        {
                            "mode": mode,
                            "fresh_install": "passed",
                            "restart": "passed",
                            "stockfish": "passed",
                            "native_review_and_health": "passed",
                            "coach_preferences": "passed",
                        }
                    ),
                    flush=True,
                )
    finally:
        for name in containers:
            # Only containers created by this invocation, with disposable anonymous volumes.
            subprocess.run(
                ["docker", "rm", "-f", "-v", name], check=True, stdout=subprocess.DEVNULL
            )


if __name__ == "__main__":
    main()
