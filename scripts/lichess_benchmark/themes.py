"""External positive labels, not negative ground truth or interchangeable skill names."""

from dataclasses import asdict, dataclass
from typing import Literal

MAPPING_VERSION = "1"


@dataclass(frozen=True)
class ThemeMapping:
    theme: str
    skill: str | None
    relationship: Literal["exact", "approximate", "unsupported"]
    semantics: str
    witness_kind: str = "skill"

    @property
    def eligible(self) -> bool:
        return self.relationship != "unsupported"

    def payload(self) -> dict:
        return asdict(self) | {"eligible": self.eligible}


MAPPINGS = (
    ThemeMapping(
        "fork",
        "fork",
        "approximate",
        "Fieldwork requires valuable non-pawn targets, a newly created attack, "
        "an uncapturable forker and collection by that piece in the bounded line. "
        "Native defensive-probe extensions are not exercised.",
    ),
    ThemeMapping(
        "pin",
        "pin",
        "approximate",
        "The line detector covers exploited absolute pins: pinned defenders or "
        "a pinned victim collected in the line. Broader relative pins need native probes.",
    ),
    ThemeMapping(
        "skewer",
        "skewer",
        "approximate",
        "Fieldwork requires a slider checking a king, then the same slider capturing "
        "the non-pawn target behind it on the next solver move; other skewers are broader.",
    ),
    ThemeMapping(
        "capturingDefender",
        "removing_defender",
        "approximate",
        "Fieldwork requires capture of the sole geometric defender, collection next, "
        "no remaining defender and its existing material-value safeguards.",
    ),
    ThemeMapping(
        "backRankMate",
        "back_rank",
        "approximate",
        "Fieldwork requires actual rook/queen mate along the home rank and at least "
        "two adjacent inward own-pawn blockers. Other own-piece barriers are broader.",
    ),
    ThemeMapping(
        "promotion",
        "promotion_awareness",
        "approximate",
        "An actual promotion witness with a visible retained material gain; "
        "promotion threats, sacrificed promotions and some mating promotions do not qualify.",
    ),
    ThemeMapping(
        "underPromotion",
        "promotion_awareness",
        "approximate",
        "Only an emitted promotion witness to knight, bishop or rook qualifies. "
        "The same material-gain restriction applies.",
        "underpromotion",
    ),
    ThemeMapping(
        "discoveredAttack",
        "discovered_attack",
        "approximate",
        "Fieldwork supports uncovered single check or opening a slider line whose "
        "valuable target that slider collects. Broader threats without collection may miss.",
    ),
    ThemeMapping(
        "discoveredCheck",
        "discovered_attack",
        "approximate",
        "Only the uncovered-single-check witness qualifies, not a nonchecking discovery "
        "or double check. This theme may not be exported separately.",
        "discovered_check",
    ),
    ThemeMapping(
        "doubleCheck",
        "double_attack",
        "exact",
        "Exact double-check event, selected from Fieldwork's broader double_attack skill. "
        "A nonchecking double attack cannot earn agreement. Adapter outcome gates still apply.",
        "double_check",
    ),
    ThemeMapping(
        "hangingPiece",
        "missed_tactical_capture",
        "approximate",
        "First solver capture, the positive-side counterpart of hanging_piece: an undefended non-pawn "
        "with immediate and retained gain. Insufficiently defended pieces are broader.",
        "initial_capture",
    ),
    ThemeMapping(
        "deflection",
        "deflection",
        "approximate",
        "Fieldwork requires a check response or recapture that moves a sole defender, "
        "followed immediately by collection of the now-undefended target.",
    ),
    ThemeMapping(
        "trappedPiece",
        "trapped_piece",
        "unsupported",
        "Production requires native counterfactual escape/capture searches, absent from CSV.",
    ),
    ThemeMapping(
        "attraction",
        None,
        "unsupported",
        "Luring a piece to a square is not equivalent to removing its defensive duty.",
    ),
    ThemeMapping(
        "overloading",
        "overloaded_defender",
        "unsupported",
        "No emitted production line detector for overloaded defenders.",
    ),
    ThemeMapping(
        "interference",
        None,
        "unsupported",
        "Blocking a line is not equivalent to capturing or deflecting its defender.",
    ),
    ThemeMapping(
        "xRayAttack",
        None,
        "unsupported",
        "Ray-through-piece motifs do not establish Fieldwork pin or skewer witnesses.",
    ),
    ThemeMapping(
        "advancedPawn",
        "promotion_awareness",
        "unsupported",
        "An advanced pawn or promotion threat is not an actual promotion witness.",
    ),
    ThemeMapping(
        "mate",
        None,
        "unsupported",
        "A mating solution cannot establish allowed/missed mate without alternative scores.",
    ),
    ThemeMapping(
        "defensiveMove",
        "defensive_resource",
        "unsupported",
        "No equivalent emitted line detector; the taxonomy ID alone is insufficient.",
    ),
    ThemeMapping(
        "sacrifice",
        None,
        "unsupported",
        "A successful sacrifice is not evidence of Fieldwork's avoiding_bad_trades label.",
    ),
)
BY_THEME = {mapping.theme: mapping for mapping in MAPPINGS}
DEFAULT_THEMES = tuple(mapping.theme for mapping in MAPPINGS if mapping.eligible)


def select_mappings(themes: list[str] | tuple[str, ...] | None) -> tuple[ThemeMapping, ...]:
    names = DEFAULT_THEMES if themes is None else tuple(dict.fromkeys(themes))
    if not names:
        raise ValueError("Select at least one eligible Lichess theme")
    selected = []
    for name in names:
        if name not in BY_THEME:
            raise ValueError(f"Unknown theme {name!r}; use --list-mappings")
        mapping = BY_THEME[name]
        if not mapping.eligible:
            raise ValueError(f"Unsupported theme {name!r}: {mapping.semantics}")
        selected.append(mapping)
    return tuple(sorted(selected, key=lambda mapping: mapping.theme))
