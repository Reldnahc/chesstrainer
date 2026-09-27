"""Portable measurements without adding a runtime dependency to Fieldwork."""

import os
import platform
import statistics
import sys


def peak_rss_bytes():
    if sys.platform == "win32":
        import ctypes
        from ctypes import wintypes

        class Counters(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("faults", wintypes.DWORD)] + [
                (name, ctypes.c_size_t)
                for name in ("peak", "working", "qp", "q", "qnp", "qn", "page", "pagepeak")
            ]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        psapi.GetProcessMemoryInfo.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(Counters),
            wintypes.DWORD,
        ]
        counters = Counters()
        counters.cb = ctypes.sizeof(counters)
        if psapi.GetProcessMemoryInfo(
            kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb
        ):
            return counters.peak
        return None
    try:
        import resource

        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return value if sys.platform == "darwin" else value * 1024
    except (ImportError, OSError):
        return None


def summary(samples):
    ordered = sorted(samples)
    return {
        "count": len(samples),
        "total_seconds": sum(samples),
        "median_seconds": statistics.median(samples) if samples else None,
        "p95_seconds": ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))]
        if samples
        else None,
    }


def machine():
    return {
        "os": platform.platform(),
        "python": platform.python_version(),
        "architecture": platform.machine(),
        "logical_cpus": os.cpu_count(),
        "processor": platform.processor(),
    }
