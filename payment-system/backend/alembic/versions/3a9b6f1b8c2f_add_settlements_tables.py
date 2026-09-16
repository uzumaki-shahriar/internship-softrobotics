"""add settlements tables

Revision ID: 3a9b6f1b8c2f
Revises: e4fbe8879d9b
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '3a9b6f1b8c2f'
down_revision: Union[str, Sequence[str], None] = 'e4fbe8879d9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'settlements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('merchant_id', sa.Integer(), nullable=False),
        sa.Column('currency_id', sa.Integer(), nullable=False),
        sa.Column('gross_total', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('fee_total', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('net_total', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('settled_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['currency_id'], ['currencies.id'], ),
        sa.ForeignKeyConstraint(['merchant_id'], ['merchants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'settlement_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('settlement_id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.Integer(), nullable=False),
        sa.Column('gross', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('fee', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('net', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['settlement_id'], ['settlements.id'], ),
        sa.ForeignKeyConstraint(['transaction_id'], ['transactions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_id', name='uq_settlement_items_transaction_id')
    )


def downgrade() -> None:
    op.drop_table('settlement_items')
    op.drop_table('settlements')
