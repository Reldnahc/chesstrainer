"""Connected original development chapter. Never installed in production."""

from trainer.study_lessons.content import CourseDefinition

OPENING = ("e2e4", "e7e5")
MAIN = (*OPENING, "g1f3", "b8c6", "f1c4")
GAME = (*MAIN, "f8c5", "c2c3", "g8f6", "d2d3", "d7d6", "e1g1", "e8g8")


def connected_course(key="connected", revision="fixture-v1"):
    def position(moves=()):
        return {"moves": moves}

    attribution = {
        "text": "Original Fieldwork development chapter and synthetic game; not a production course.",
        "license": "CC0-1.0",
    }
    return CourseDefinition.model_validate(
        {
            "id": key,
            "revision": revision,
            "title": "Connected lesson fixture",
            "description": "Development coverage of every lesson step and saved transition.",
            "learner_color": "white",
            "attributions": [attribution],
            "lines": [
                {
                    "id": "fixture-main",
                    "title": "Fixture main line",
                    "moves": MAIN,
                    "repertoire": True,
                    "eco": "C50",
                },
                {
                    "id": "example-only",
                    "title": "Demonstration only",
                    "moves": GAME,
                    "repertoire": False,
                },
            ],
            "games": [
                {
                    "id": "fixture-game",
                    "title": "Development game",
                    "moves": GAME,
                    "attributions": [attribution],
                    "annotations": [
                        {"ply": 6, "text": "Black develops the bishop to c5."},
                        {
                            "ply": 7,
                            "text": "The c3-pawn supports d4.",
                            "annotations": {
                                "squares": ["c3", "d4"],
                                "arrows": [{"from_square": "c3", "to_square": "d4"}],
                            },
                        },
                    ],
                }
            ],
            "chapters": [
                {
                    "id": "connected",
                    "title": "A complete lesson journey",
                    "entry_step": "welcome",
                    "steps": [
                        {
                            "id": "welcome",
                            "kind": "explanation",
                            "title": "Start from the beginning",
                            "text": "Watch the opening form, then practice its moves.",
                            "next_step": "center",
                        },
                        {
                            "id": "center",
                            "kind": "demonstration",
                            "title": "Both sides enter the center",
                            "text": "The e-pawns open paths for the bishops.",
                            "moves": OPENING,
                            "next_step": "develop",
                        },
                        {
                            "id": "develop",
                            "kind": "decision",
                            "title": "Develop a knight",
                            "text": "Play a knight move taught in this lesson.",
                            "position": position(OPENING),
                            "hint": "Develop the kingside knight toward the center.",
                            "choices": [
                                {
                                    "uci": "g1f3",
                                    "next_step": "opponent-choice",
                                    "feedback": "Nf3 develops the knight and attacks e5.",
                                },
                                {
                                    "uci": "b1c3",
                                    "next_step": "other-knight",
                                    "feedback": "Nc3 develops the other knight into a different line.",
                                },
                            ],
                        },
                        {
                            "id": "other-knight",
                            "kind": "explanation",
                            "title": "A separate continuation",
                            "position": position((*OPENING, "b1c3")),
                            "text": "This line developed the queenside knight. It does not continue as Nf3.",
                            "next_step": None,
                        },
                        {
                            "id": "opponent-choice",
                            "kind": "branch",
                            "title": "Another way to defend e5",
                            "position": position(MAIN[:3]),
                            "text": "Explore Black's d6 reply, then return to this exact position.",
                            "branch_start": "quiet-reply",
                            "next_step": "main-development",
                        },
                        {
                            "id": "quiet-reply",
                            "kind": "demonstration",
                            "title": "The pawn defense",
                            "position": position(MAIN[:3]),
                            "text": "Black supports e5 with a pawn; White develops the bishop.",
                            "moves": ["d7d6", "f1c4"],
                            "next_step": "quiet-explanation",
                        },
                        {
                            "id": "quiet-explanation",
                            "kind": "explanation",
                            "title": "Return to the main lesson",
                            "position": position((*MAIN[:3], "d7d6", "f1c4")),
                            "text": "This is a different position. Return before continuing with Nc6.",
                            "next_step": None,
                        },
                        {
                            "id": "main-development",
                            "kind": "demonstration",
                            "title": "Develop toward the center",
                            "position": position(MAIN[:3]),
                            "text": "Nc6 defends e5; Bc4 develops White's bishop.",
                            "moves": MAIN[3:],
                            "next_step": "example",
                        },
                        {
                            "id": "example",
                            "kind": "game_excerpt",
                            "title": "See the plan in a game",
                            "text": "Replay the passage. The full game shows how this position arose.",
                            "position": position(MAIN),
                            "game_id": "fixture-game",
                            "from_ply": 5,
                            "to_ply": 7,
                            "next_step": "recall",
                        },
                        {
                            "id": "recall",
                            "kind": "rehearsal",
                            "title": "Play the line yourself",
                            "text": "Play your studied moves. Black's replies are automatic.",
                            "line_id": "fixture-main",
                            "next_step": None,
                        },
                    ],
                }
            ],
        }
    )


class BrowserLessonProvider:
    """A test-only mutable provider, injected into the real application."""

    def __init__(self):
        self._accounts = {}

    def courses(self, db):
        return tuple(self._accounts.get(db.info["user_id"], {}).values())

    def install(self, user_id, key):
        course = connected_course(key)
        self._accounts.setdefault(user_id, {})[key] = course
        return course
