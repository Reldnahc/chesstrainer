from trainer.cancellation import throttled


def test_throttled_checks_immediately_then_at_most_once_per_interval(monkeypatch):
    clock = [0.0]
    calls = []
    flag = [False]
    monkeypatch.setattr("trainer.cancellation.monotonic", lambda: clock[0])

    def cancelled():
        calls.append(clock[0])
        return flag[0]

    check = throttled(cancelled, interval=0.25)
    assert check() is False and calls == [0.0]
    clock[0] = 0.2
    assert check() is False and calls == [0.0]  # Within the interval: no database read.
    clock[0] = 0.3
    flag[0] = True
    assert check() is True and calls == [0.0, 0.3]
    clock[0] = 10.0
    assert check() is True and calls == [0.0, 0.3]  # A cancellation is final.
    assert throttled(None) is None
