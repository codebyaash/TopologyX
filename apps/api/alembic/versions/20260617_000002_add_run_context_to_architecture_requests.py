"""add run context to architecture requests

Revision ID: 20260617_000002
Revises: 20260617_000001
Create Date: 2026-06-17 00:35:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260617_000002"
down_revision = "20260617_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("architecture_requests", sa.Column("recommendation_key", sa.String(length=32), nullable=True))
    op.add_column("architecture_requests", sa.Column("recommendation_label", sa.String(length=80), nullable=True))
    op.add_column("architecture_requests", sa.Column("recommendation_description", sa.Text(), nullable=True))
    op.add_column("architecture_requests", sa.Column("traffic_profile", sa.String(length=20), nullable=True))
    op.add_column("architecture_requests", sa.Column("region_count", sa.Integer(), nullable=True))
    op.add_column("architecture_requests", sa.Column("observability_depth", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("architecture_requests", "observability_depth")
    op.drop_column("architecture_requests", "region_count")
    op.drop_column("architecture_requests", "traffic_profile")
    op.drop_column("architecture_requests", "recommendation_description")
    op.drop_column("architecture_requests", "recommendation_label")
    op.drop_column("architecture_requests", "recommendation_key")
