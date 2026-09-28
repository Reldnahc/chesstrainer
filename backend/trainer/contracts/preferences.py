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
    "cat-tuxedo",
    "cat-black",
    "dog-gentle",
    "dog-corgi",
    "dog-collie",
    "human-boy",
    "human-girl",
    "dog-puppy",
    "cat-kitten",
    "alien",
    "unicorn",
    "gorilla",
    "robot",
    "wizard",
    "slime",
    "dragon",
    "ghost",
    "raccoon",
    "frog",
    "capybara",
    "mushroom",
    "living-pawn",
]
MotionPreference = Literal["system", "natural", "still"]
CoachMotion = MotionPreference


class CoachPreferences(Contract):
    coach_id: CoachId = "classic"
    motion: CoachMotion = "system"


class MotionPreferences(Contract):
    motion: MotionPreference = "system"
