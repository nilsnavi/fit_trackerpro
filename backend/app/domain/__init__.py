"""
Domain layer: ORM entities (SQLAlchemy) and domain exceptions.

Import concrete models from submodules, e.g. ``from app.domain.user import User``.
For full ``Base.metadata`` registration, import ``app.domain.registry`` alongside
``app.domain.base.Base`` (see ``app.infrastructure.database``).
"""
from app.domain.base import Base

__all__ = ["Base"]
