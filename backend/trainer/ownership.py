"""Account-bound ORM sessions: one database, explicit ownership on private rows.

Never pass an administrative session into a request or a job. A bound session
filters reads, bulk updates and deletes, stamps inserts, and validates private
foreign keys before flush. Engine analyses and the skill taxonomy are shared.
"""

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, sessionmaker, with_loader_criteria

from trainer.models import AuthSession, Base, Owned, User


class AccountSession(Session):
    pass


def account_sessions(engine, user_id="local"):
    if not user_id:
        raise ValueError("An account identity is required")
    return sessionmaker(
        engine, class_=AccountSession, expire_on_commit=False, info={"user_id": user_id}
    )


@event.listens_for(AccountSession, "do_orm_execute")
def scope_statements(state):
    user_id = state.session.info["user_id"]
    if not state.is_orm_statement:
        raise ValueError("Raw SQL is not allowed in account sessions")
    if state.is_insert:
        # Native engine cache upserts are the only Core inserts used by the app.
        from trainer.models import EngineAnalysis

        if state.statement.table.name != EngineAnalysis.__tablename__:
            raise ValueError("Private inserts must pass through ownership validation")
    if state.is_update:
        for key in state.statement._values or {}:
            name = getattr(key, "key", key)
            column = state.statement.table.c.get(name)
            if name == "user_id" or (column is not None and column.foreign_keys):
                raise ValueError("Ownership and references require validated ORM writes")
    if state.is_select or state.is_update or state.is_delete:
        state.statement = state.statement.options(
            with_loader_criteria(Owned, lambda row: row.user_id == user_id, include_aliases=True),
            with_loader_criteria(User, lambda row: row.id == user_id, include_aliases=True),
            with_loader_criteria(
                AuthSession, lambda row: row.user_id == user_id, include_aliases=True
            ),
        )


@event.listens_for(AccountSession, "before_flush")
def validate_ownership(db, context, instances):
    owner = db.info["user_id"]
    owned_models = {
        mapper.local_table.name: mapper.class_
        for mapper in Base.registry.mappers
        if issubclass(mapper.class_, Owned)
    }
    for row in db.new | db.dirty | db.deleted:
        if isinstance(row, (User, AuthSession)):
            raise ValueError("Account credentials require the authentication service")
        if not isinstance(row, Owned):
            continue
        if row in db.new and row.user_id is None:
            row.user_id = owner
        if row.user_id != owner or inspect(row).attrs.user_id.history.deleted:
            raise ValueError("Account ownership cannot be changed")
        for column in row.__table__.columns:
            value = getattr(row, column.key)
            if value is None:
                continue
            for fk in column.foreign_keys:
                parent = owned_models.get(fk.column.table.name)
                if parent is None:
                    continue
                # All references into private entities target a single-column primary key.
                pending = any(
                    isinstance(item, parent)
                    and getattr(item, fk.column.key) == value
                    and item.user_id in (None, owner)
                    for item in db.new
                )
                if not pending and db.get(parent, value) is None:
                    raise ValueError("Referenced item is not in this account")
