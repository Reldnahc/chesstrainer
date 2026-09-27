from typing import Literal

from trainer.contracts.common import Contract

CoachId = Literal["classic"]
CoachMotion = Literal["natural", "subtle", "still"]


class CoachPreferences(Contract):
    coach_id: CoachId = "classic"
    motion: CoachMotion = "natural"
