"""Drop the archived lesson, course and repertoire tables.

Lessons, model teaching and repertoire training were removed from the product;
their tables were kept only as history nothing read. The owner chose to drop
them. Saved review sessions that were lesson attempts stay, marked with mode
"lesson" so Review keeps treating them as archived; repertoire exercises stay
as archived cards (source "repertoire"). Exercises lose the repertoire link and
review sessions the lesson-item link.

The downgrade recreates the tables empty, with their last schema, and the two
link columns empty.
"""

import sqlalchemy as sa
from alembic import op

revision = "4ca1e88adf37"
down_revision = "5745573b0835"
branch_labels = None
depends_on = None

# Children before parents.
DROPPED = (
    "unit_evidence",
    "teaching_runs",
    "lesson_items",
    "lessons",
    "course_revisions",
    "course_units",
    "courses",
    "repertoires",
)
# The last schema of each dropped table and its indexes, parents first.
RECREATE = (
    'CREATE TABLE "courses" ( id VARCHAR NOT NULL, title VARCHAR NOT NULL, target_rating INTEGER NOT NULL, active BOOLEAN NOT NULL, created_at DATETIME NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_courses PRIMARY KEY (id), CONSTRAINT fk_courses_user FOREIGN KEY(user_id) REFERENCES users (id) )',
    "CREATE INDEX ix_courses_user_id ON courses (user_id)",
    'CREATE TABLE "course_revisions" ( id VARCHAR NOT NULL, course_id VARCHAR NOT NULL, fingerprint VARCHAR NOT NULL, snapshot JSON NOT NULL, created_at DATETIME NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_course_revisions PRIMARY KEY (id), CONSTRAINT fk_course_revisions_course_id_courses FOREIGN KEY(course_id) REFERENCES courses (id), CONSTRAINT fk_course_revisions_user FOREIGN KEY(user_id) REFERENCES users (id) )',
    "CREATE INDEX ix_course_revisions_course_id ON course_revisions (course_id)",
    "CREATE INDEX ix_course_revisions_user_id ON course_revisions (user_id)",
    "CREATE TABLE \"course_units\" ( id VARCHAR NOT NULL, course_id VARCHAR NOT NULL, skill_id VARCHAR NOT NULL, title VARCHAR NOT NULL, rationale TEXT NOT NULL, ordinal INTEGER NOT NULL, provisional BOOLEAN NOT NULL, group_key VARCHAR DEFAULT ('') NOT NULL, active BOOLEAN DEFAULT '1' NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_course_units PRIMARY KEY (id), CONSTRAINT fk_course_units_course_id_courses FOREIGN KEY(course_id) REFERENCES courses (id), CONSTRAINT fk_course_units_skill_id_skills FOREIGN KEY(skill_id) REFERENCES skills (id), CONSTRAINT fk_course_units_user FOREIGN KEY(user_id) REFERENCES users (id) )",
    "CREATE INDEX ix_course_units_user_id ON course_units (user_id)",
    'CREATE TABLE "unit_evidence" ( unit_id VARCHAR NOT NULL, evidence_id VARCHAR NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_unit_evidence PRIMARY KEY (unit_id, evidence_id), CONSTRAINT fk_unit_evidence_user FOREIGN KEY(user_id) REFERENCES users (id), CONSTRAINT fk_unit_evidence_evidence_id_skill_evidence FOREIGN KEY(evidence_id) REFERENCES skill_evidence (id), CONSTRAINT fk_unit_evidence_unit_id_course_units FOREIGN KEY(unit_id) REFERENCES course_units (id) )',
    "CREATE INDEX ix_unit_evidence_user_id ON unit_evidence (user_id)",
    'CREATE TABLE "teaching_runs" ( id VARCHAR NOT NULL, unit_id VARCHAR NOT NULL, cache_key VARCHAR NOT NULL, model VARCHAR NOT NULL, schema_version VARCHAR NOT NULL, prompt_version VARCHAR NOT NULL, evidence_ids JSON NOT NULL, response JSON, confidence FLOAT, status VARCHAR NOT NULL, error VARCHAR, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, attempts INTEGER NOT NULL, created_at DATETIME NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_teaching_runs PRIMARY KEY (id), CONSTRAINT uq_teaching_runs_user_cache_key UNIQUE (user_id, cache_key), CONSTRAINT fk_teaching_runs_unit_id_course_units FOREIGN KEY(unit_id) REFERENCES course_units (id), CONSTRAINT fk_teaching_runs_user FOREIGN KEY(user_id) REFERENCES users (id) )',
    "CREATE INDEX ix_teaching_runs_unit_id ON teaching_runs (unit_id)",
    "CREATE INDEX ix_teaching_runs_user_id ON teaching_runs (user_id)",
    "CREATE TABLE \"lessons\" ( id VARCHAR NOT NULL, unit_id VARCHAR NOT NULL, stage VARCHAR NOT NULL, ordinal INTEGER NOT NULL, completed BOOLEAN NOT NULL, check_rounds INTEGER DEFAULT '0' NOT NULL, last_check_correct INTEGER DEFAULT '0' NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_lessons PRIMARY KEY (id), CONSTRAINT fk_lessons_unit_id_course_units FOREIGN KEY(unit_id) REFERENCES course_units (id), CONSTRAINT fk_lessons_user FOREIGN KEY(user_id) REFERENCES users (id) )",
    "CREATE INDEX ix_lessons_user_id ON lessons (user_id)",
    'CREATE TABLE "lesson_items" ( id VARCHAR NOT NULL, lesson_id VARCHAR NOT NULL, exercise_id VARCHAR NOT NULL, ordinal INTEGER NOT NULL, completed BOOLEAN NOT NULL, clean BOOLEAN NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_lesson_items PRIMARY KEY (id), CONSTRAINT uq_lesson_items_lesson_id UNIQUE (lesson_id, ordinal), CONSTRAINT fk_lesson_items_user FOREIGN KEY(user_id) REFERENCES users (id), CONSTRAINT fk_lesson_items_exercise_id_exercises FOREIGN KEY(exercise_id) REFERENCES exercises (id), CONSTRAINT fk_lesson_items_lesson_id_lessons FOREIGN KEY(lesson_id) REFERENCES lessons (id) )',
    "CREATE INDEX ix_lesson_items_user_id ON lesson_items (user_id)",
    "CREATE INDEX ix_lesson_items_lesson_id ON lesson_items (lesson_id)",
    'CREATE TABLE "repertoires" ( id VARCHAR NOT NULL, name VARCHAR NOT NULL, color BOOLEAN NOT NULL, pgn TEXT NOT NULL, user_id VARCHAR NOT NULL, CONSTRAINT pk_repertoires PRIMARY KEY (id), CONSTRAINT fk_repertoires_user FOREIGN KEY(user_id) REFERENCES users (id) )',
    "CREATE INDEX ix_repertoires_user_id ON repertoires (user_id)",
)


def upgrade():
    bind = op.get_bind()
    bind.exec_driver_sql(
        "UPDATE review_sessions SET mode = 'lesson' WHERE lesson_item_id IS NOT NULL"
    )
    with op.batch_alter_table("review_sessions") as batch:
        batch.drop_column("lesson_item_id")
    with op.batch_alter_table("exercises") as batch:
        batch.drop_column("repertoire_id")
    for table in DROPPED:
        op.drop_table(table)


def downgrade():
    bind = op.get_bind()
    for statement in RECREATE:
        bind.exec_driver_sql(statement)
    with op.batch_alter_table("exercises") as batch:
        batch.add_column(sa.Column("repertoire_id", sa.String(), nullable=True))
        batch.create_foreign_key(
            "fk_exercises_repertoire_id_repertoires", "repertoires", ["repertoire_id"], ["id"]
        )
    with op.batch_alter_table("review_sessions") as batch:
        batch.add_column(sa.Column("lesson_item_id", sa.String(), nullable=True))
        batch.create_foreign_key(
            "fk_review_sessions_lesson_item_id_lesson_items",
            "lesson_items",
            ["lesson_item_id"],
            ["id"],
        )
    # Which lesson item a session belonged to is gone; it reads as a review again.
    bind.exec_driver_sql("UPDATE review_sessions SET mode = 'review' WHERE mode = 'lesson'")
