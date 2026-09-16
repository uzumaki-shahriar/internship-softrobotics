"""add payment and refund bank references

Revision ID: f7b8c9d0e1f2
Revises: 3a9b6f1b8c2f
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = "f7b8c9d0e1f2"
down_revision: Union[str, None] = "3a9b6f1b8c2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("bank_reference", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column("transactions", sa.Column("decline_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f("ix_transactions_bank_reference"), "transactions", ["bank_reference"], unique=False)

    op.add_column("refunds", sa.Column("idempotency_key", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column("refunds", sa.Column("bank_reference", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column("refunds", sa.Column("decline_reason", sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f("ix_refunds_idempotency_key"), "refunds", ["idempotency_key"], unique=True)
    op.create_index(op.f("ix_refunds_bank_reference"), "refunds", ["bank_reference"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_refunds_bank_reference"), table_name="refunds")
    op.drop_index(op.f("ix_refunds_idempotency_key"), table_name="refunds")
    op.drop_column("refunds", "decline_reason")
    op.drop_column("refunds", "bank_reference")
    op.drop_column("refunds", "idempotency_key")
    op.drop_index(op.f("ix_transactions_bank_reference"), table_name="transactions")
    op.drop_column("transactions", "decline_reason")
    op.drop_column("transactions", "bank_reference")
