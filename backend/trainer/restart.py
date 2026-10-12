"""Restart the server in place when ``python -m trainer`` runs it.

The entry point serves in a loop: a requested restart stops Uvicorn gracefully,
which drains requests and runs shutdown, and the loop starts it again with freshly
loaded settings. Servers started another way (``uvicorn`` directly, tests) cannot
restart themselves and report that.
"""

server = None
requested = False


def available():
    return server is not None


def request():
    global requested
    if server is None:
        raise RuntimeError("This server was not started by python -m trainer")
    requested = True
    server.should_exit = True
