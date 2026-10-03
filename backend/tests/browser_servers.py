"""Start every Playwright application server at once and answer when all are healthy.

Playwright starts the entries of a webServer list one after another, waiting for
each to be ready. One launcher that starts every per-worker server together and
then serves a readiness URL turns that wait into a single startup.

Run: python backend/tests/browser_servers.py --ready-port 8769 --ports 8765,8771 \
    --database-template data/ui-test-{stamp}-{index}.sqlite3
"""

import argparse
import os
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def healthy(port):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2) as response:
            return response.status == 200
    except (urllib.error.URLError, OSError, ValueError):
        return False


class Ready(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ready\n")

    def log_message(self, *_):
        pass


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ready-port", type=int, required=True)
    parser.add_argument("--ports", required=True, help="Comma-separated server ports")
    parser.add_argument(
        "--database-template",
        required=True,
        help="Database path per server; {index} is the server's position",
    )
    parser.add_argument("--timeout", type=float, default=120.0)
    args = parser.parse_args(argv)
    ports = [int(port) for port in args.ports.split(",")]
    children = []
    for index, port in enumerate(ports):
        env = dict(os.environ, DATABASE_PATH=args.database_template.format(index=index))
        children.append(
            subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "browser_app:create_app",
                    "--app-dir",
                    "backend/tests",
                    "--factory",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                ],
                cwd=ROOT,
                env=env,
            )
        )

    def stop(code=0, *_):
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
        raise SystemExit(code)

    for name in ("SIGTERM", "SIGINT", "SIGBREAK"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), lambda *_: stop(0))

    deadline = time.monotonic() + args.timeout
    pending = set(ports)
    while pending:
        for child in children:
            if child.poll() is not None:
                print(f"server exited early with code {child.returncode}", file=sys.stderr)
                stop(1)
        pending = {port for port in pending if not healthy(port)}
        if pending and time.monotonic() > deadline:
            print(f"servers on ports {sorted(pending)} never became healthy", file=sys.stderr)
            stop(1)
        if pending:
            time.sleep(0.2)

    ready = HTTPServer(("127.0.0.1", args.ready_port), Ready)
    threading.Thread(target=ready.serve_forever, daemon=True).start()
    while all(child.poll() is None for child in children):
        time.sleep(0.5)
    print("a server exited; stopping the rest", file=sys.stderr)
    stop(1)


if __name__ == "__main__":
    raise SystemExit(main())
