from typing import Literal

from trainer.contracts.common import Contract

CoachId = Literal[
    "classic",
    "man-host",
    "man-expert",
    "man-partner",
    "woman-captain",
    "woman-analyst",
    "woman-spark",
    "woman-blonde",
    "cat-tabby",
    "cat-tuxedo",
    "cat-calico",
    "cat-black",
    "dog-sunny",
    "dog-gentle",
    "dog-corgi",
    "dog-collie",
]
MotionPreference = Literal["system", "natural", "still"]
CoachMotion = MotionPreference


class CoachPreferences(Contract):
    coach_id: CoachId = "classic"
    motion: CoachMotion = "system"


class MotionPreferences(Contract):
    motion: MotionPreference = "system"
