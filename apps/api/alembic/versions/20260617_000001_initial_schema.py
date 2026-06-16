"""initial schema

Revision ID: 20260617_000001
Revises: None
Create Date: 2026-06-17 00:10:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260617_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "architecture_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "architecture_outputs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("architecture_requests.id"), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("raw_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_table(
        "diagram_nodes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("output_id", sa.Integer(), sa.ForeignKey("architecture_outputs.id"), nullable=False),
        sa.Column("node_key", sa.String(length=120), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=False),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
    )

    op.create_table(
        "diagram_edges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("output_id", sa.Integer(), sa.ForeignKey("architecture_outputs.id"), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("target", sa.String(length=120), nullable=False),
    )

    op.create_table(
        "cost_estimates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("output_id", sa.Integer(), sa.ForeignKey("architecture_outputs.id"), nullable=False),
        sa.Column("service", sa.String(length=160), nullable=False),
        sa.Column("assumption", sa.Text(), nullable=False),
        sa.Column("monthly_usd", sa.Integer(), nullable=False),
    )

    op.create_table(
        "security_findings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("output_id", sa.Integer(), sa.ForeignKey("architecture_outputs.id"), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("remediation", sa.Text(), nullable=False),
    )

    op.create_table(
        "iac_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("output_id", sa.Integer(), sa.ForeignKey("architecture_outputs.id"), nullable=False),
        sa.Column("language", sa.String(length=40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("iac_templates")
    op.drop_table("security_findings")
    op.drop_table("cost_estimates")
    op.drop_table("diagram_edges")
    op.drop_table("diagram_nodes")
    op.drop_table("architecture_outputs")
    op.drop_table("architecture_requests")
    op.drop_table("projects")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
