import pytest
from trainer.cancellation import WaitTimedOut
from trainer.lazy_pool import LazyPool, PoolClosed


class Resource:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def test_a_slot_builds_once_and_reuses_its_resource():
    built = []
    pool = LazyPool(1, lambda: built.append(Resource()) or built[-1])
    with pool.lease() as first:
        pass
    with pool.lease() as second:
        pass
    assert first is second and built == [first] and not first.closed


def test_a_failed_lease_discards_its_resource_and_the_slot_builds_anew():
    pool = LazyPool(1, Resource)
    with pytest.raises(RuntimeError):
        with pool.lease() as failed:
            raise RuntimeError("process died")
    assert failed.closed and failed not in pool.live
    with pool.lease() as fresh:
        assert fresh is not failed and not fresh.closed


def test_a_refused_lease_hands_its_resource_back_unused():
    pool = LazyPool(1, Resource)
    with pool.lease() as kept:
        pass
    refuse = {"now": False}

    def admit():
        if refuse["now"]:
            raise LookupError("cooling down")
        refuse["now"] = True  # Admit the first try, refuse once the slot is taken.

    with pytest.raises(LookupError):
        with pool.lease(admit=admit):
            pytest.fail("A refused lease must not run")
    assert not kept.closed
    with pool.lease() as again:
        assert again is kept


def test_waiting_for_a_busy_slot_times_out():
    pool = LazyPool(1, Resource)
    with pool.lease():
        with pytest.raises(WaitTimedOut):
            with pool.lease(deadline=0):
                pass


def test_close_closes_every_resource_and_builds_no_more():
    pool = LazyPool(2, Resource)
    with pool.lease() as idle:
        pass
    with pool.lease() as leased:
        pool.close()
    assert idle.closed and leased.closed
    with pytest.raises(PoolClosed):
        with pool.lease():
            pass
