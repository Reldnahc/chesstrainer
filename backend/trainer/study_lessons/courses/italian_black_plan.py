"""The quiet Italian's post-castling decisions, separate from its basic setup."""

from trainer.study_lessons.courses.authoring import decision, demo, position, step


def quiet_plan(quiet):
    restrained = quiet + " Re1 a5 Nbd2"
    offered = restrained + " Be6"
    exchanged = offered + " Bxe6 fxe6"
    steps = [
        step(
            "explanation",
            "plan-welcome",
            "Castling is the starting point for a plan",
            "Begin from the quiet setup you learned earlier. Both kings are safe, but your c8-bishop is undeveloped. This chapter connects three choices: restrain White's queenside expansion, challenge the active bishop, and understand the pawn structure if White exchanges.",
            quiet,
            next_step="plan-arrival",
        ),
        demo(
            "plan-arrival",
            "White supports the center",
            "Re1 adds support to e4. White can also prepare b4 to gain queenside space, so improving your remaining bishop should take that expansion into account.",
            quiet,
            quiet + " Re1",
            "plan-restrain",
        ),
        decision(
            "plan-restrain",
            "Restrain before exchanging",
            "Use the a-pawn to add control of b4 before developing the c8-bishop.",
            quiet + " Re1",
            "a5",
            "Nbd2",
            "plan-bishop",
            "a5 controls b4 alongside your c5-bishop. White develops Nbd2. The extra pawn control makes a queenside expansion harder to support, leaving you better placed to challenge White's active bishop.",
            "Advance the a7-pawn to a5.",
        ),
        decision(
            "plan-bishop",
            "Challenge White's active bishop",
            "Develop the c8-bishop to a square where it attacks White's bishop on c4. Be ready to recapture if White chooses the exchange.",
            restrained,
            "Be6",
            "Bxe6",
            "plan-recapture",
            "Be6 challenges the bishop on c4. White can keep the bishops on the board, but chooses Bxe6 in our study line. First restore material before planning anything else.",
            "Develop the bishop from c8 to e6.",
        ),
        decision(
            "plan-recapture",
            "Accept a structural tradeoff",
            "Recapture White's bishop with your f-pawn. Then compare what the pawn move gains and what it gives up.",
            offered + " Bxe6",
            "fxe6",
            None,
            "plan-summary",
            "Material is equal again. You have doubled e-pawns, but the new e6-pawn supports d5 and f5. Your f-file is semi-open: White still has a pawn on f2. An open line is a future resource, not an immediate attack.",
            "Capture from f7 to e6.",
        ),
        step(
            "explanation",
            "plan-summary",
            "Read the position after the exchange",
            "Your a5-pawn restrains b4; it does not make that advance impossible. Your doubled e-pawns cannot defend each other, although e6 supports useful central squares. The f6-knight blocks your rook's route along the f-file, so the rook does not attack f2 yet. White still has c3 ready to support d4. If White keeps the bishops instead of exchanging, or changes the center, reassess rather than replaying this sequence automatically.",
            exchanged,
            next_step="plan-recall",
            annotations={"squares": ["a5", "b4", "e5", "e6", "f6"]},
        ),
        step(
            "rehearsal",
            "plan-recall",
            "Connect the plan to the tradeoff",
            "Recall just the new decisions from the castled position.",
            quiet,
            line_id="black-quiet-bishop-plan",
        ),
    ]
    return (
        dict(
            id="quiet-bishop-plan",
            title="Choose a plan after castling",
            entry_step=steps[0]["id"],
            steps=steps,
        ),
        dict(
            id="black-quiet-bishop-plan",
            title="Black Italian · restrain and exchange",
            position=position(quiet),
            moves=position(exchanged).moves[len(position(quiet).moves) :],
            repertoire=True,
            eco="C50",
        ),
    )
