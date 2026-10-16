"""docs/ARCHITECTURE.md describes the schema the models define."""

import re
from pathlib import Path

from trainer.models import Base

ARCHITECTURE = Path(__file__).resolve().parents[2] / "docs" / "ARCHITECTURE.md"


def test_the_table_list_names_every_table_once():
    text = ARCHITECTURE.read_text(encoding="utf-8")
    section = text.split("### Current and archival relationships", 1)[1]
    listed = []
    for row in section.split("\n\n", 2)[1].splitlines()[2:]:
        listed += [name.strip() for name in row.split("|")[1].split(",")]
    assert sorted(listed) == sorted(Base.metadata.tables)
    count = re.search(r"There are (\d+) application tables", section)
    assert int(count.group(1)) == len(Base.metadata.tables)
