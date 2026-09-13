"""External positive labels, not negative ground truth or interchangeable skill names."""

from dataclasses import asdict, dataclass
from typing import Literal

MAPPING_VERSION = "2"


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
        "Pinned Lichess fork recognition plus existing collection witnesses. Upstream tests "
        "valuable non-pawn targets and forker safety; Fieldwork outcome/episode gates remain. "
        "Native defensive-probe extensions are not exercised.",
    ),
    ThemeMapping(
        "pin",
        "pin",
        "approximate",
        "Pinned Lichess absolute-pin predicates recognize restricted captures or escape; "
        "existing collection witnesses remain. Relative pins need native probes. "
        "Fieldwork outcome/episode gates remain.",
    ),
    ThemeMapping(
        "skewer",
        "skewer",
        "approximate",
        "Pinned Lichess skewer predicate supports aligned front targets beyond kings, "
        "with same-slider collection; existing king-skewer witnesses remain. "
        "Fieldwork outcome/episode gates remain.",
    ),
    ThemeMapping(
        "capturingDefender",
        "removing_defender",
        "approximate",
        "Pinned Lichess capture-of-defender predicate plus existing collection witnesses. "
        "Fieldwork retains its reviewed free-queen/pawn-cleanup attribution safeguard "
        "and outcome/episode gates.",
    ),
    ThemeMapping(
        "backRankMate",
        "back_rank",
        "approximate",
        "Pinned Lichess actual back-rank mate with own-piece escape barriers, plus existing "
        "rook/queen-and-pawn witnesses. Terminal mate must appear in the bounded line.",
    ),
    ThemeMapping(
        "promotion",
        "promotion_awareness",
        "approximate",
        "An actual promotion from the upstream predicate or existing retained-gain witness; "
        "promotion threats do not qualify. Fieldwork outcome/episode gates remain.",
    ),
    ThemeMapping(
        "underPromotion",
        "promotion_awareness",
        "approximate",
        "Project actual knight/bishop/rook promotion witnesses from the broader promotion skill. "
        "The raw upstream under_promotion predicate excludes rook/bishop mating promotions; "
        "this projection can include them. Fieldwork outcome/episode gates remain.",
        "underpromotion",
    ),
    ThemeMapping(
        "discoveredAttack",
        "discovered_attack",
        "approximate",
        "Pinned Lichess uncovered single check or discovered line capture, plus existing "
        "collection witnesses. Quiet threats without collection may miss. "
        "Fieldwork outcome/episode gates remain.",
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
        "First solver capture, the positive-side counterpart of hanging_piece: upstream "
        "undefended-piece capture with real setup context or existing retained-gain witness. "
        "Fieldwork outcome gates remain; insufficiently defended pieces are broader.",
        "initial_capture",
    ),
    ThemeMapping(
        "deflection",
        "deflection",
        "approximate",
        "Pinned Lichess deflection sequences plus existing check/recapture and collection "
        "witnesses. Broader attraction is not substituted. Fieldwork outcome/episode gates remain.",
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
