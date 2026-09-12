TAXONOMY_VERSION = "1"
GROUPS = {
    "Tactical awareness": "hanging_piece opponent_threat_recognition fork pin skewer discovered_attack double_attack overloaded_defender removing_defender back_rank mating_pattern missed_tactical_capture",
    "Opening and development": "development king_safety castling center_control premature_queen_activity opening_repertoire",
    "Material and conversion": "material_awareness simplifying_when_ahead avoiding_bad_trades conversion piece_activity",
    "Pawn play": "pawn_structure pawn_breaks passed_pawns promotion_awareness",
    "Endgames": "king_activity king_and_pawn_endgames rook_endgames minor_piece_endgames basic_mates",
    "Decision making": "opponent_plan_awareness calculation move_order forcing_moves defensive_resource",
    "Unclassified": "unclassified",
}
SKILLS = {
    skill: {"category": group, "title": skill.replace("_", " ").capitalize()}
    for group, skills in GROUPS.items()
    for skill in skills.split()
}


def seed_skills(db):
    from trainer.models import Skill

    for key, data in SKILLS.items():
        if db.get(Skill, key) is None:
            db.add(Skill(id=key, **data))
    db.commit()
