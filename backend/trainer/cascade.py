"""What removing rows takes with it, read from the models' foreign keys.

The schema declares no ``ON DELETE`` rules, so every delete that removes more
than one row goes through this module instead of a hand-kept list:

- ``owned_tables`` is every table holding an account's rows, for deleting an
  account (``accounts.Accounts.delete``).
- ``cascade`` follows foreign keys from root rows to everything that refers to
  them, for removing an account's games (``scripts/clear_games.py``).

Both read ``Base.metadata``, so a new table or reference takes part without a
change here. Shared rows (users, skills, the engine and Maia caches) are only
ever referred to and so are never reached by a cascade; the caches are swept
afterwards (``cache_maintenance``).
"""

from trainer.models import Base

# References that outlive the rows they point at: set to NULL instead of removing
# the row. A game played in Play keeps its moves and reports when its saved
# library copy goes.
UNLINKED = frozenset({("play_games", "saved_game_id")})


def owned_tables():
    """Every table with an owner column, children before parents, users excluded."""
    return [
        table
        for table in reversed(Base.metadata.sorted_tables)
        if table.name != "users" and "user_id" in table.c
    ]


def cascade(roots):
    """{table name: SQL condition} for every row a removal of ``roots`` takes.

    ``roots`` maps table names to the condition selecting their removed rows. A
    table joins when any of its foreign keys points at a removed row, except the
    references in ``UNLINKED``. Each condition reads the removed rows of the
    tables it refers to from ``temp."clear_<table>"``, which the caller fills in
    the order returned (parents before children) before deleting anything.
    """
    removed = {}
    for table in Base.metadata.sorted_tables:
        if table.name in roots:
            removed[table.name] = roots[table.name]
            continue
        references = [
            f'"{key.parent.name}" IN (SELECT "{key.column.name}" FROM temp."clear_{key.column.table.name}")'
            for key in sorted(table.foreign_keys, key=lambda key: key.parent.name)
            if key.column.table.name in removed and (table.name, key.parent.name) not in UNLINKED
        ]
        if references:
            removed[table.name] = " OR ".join(references)
    return removed


def unlinked(removed):
    """(table, column, condition) for each ``UNLINKED`` reference into removed rows."""
    return [
        (
            table.name,
            key.parent.name,
            f'"{key.parent.name}" IN (SELECT "{key.column.name}" FROM temp."clear_{key.column.table.name}")',
        )
        for table in Base.metadata.sorted_tables
        for key in table.foreign_keys
        if (table.name, key.parent.name) in UNLINKED and key.column.table.name in removed
    ]
