from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ArchitectureRequest(Base):
    __tablename__ = "architecture_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    prompt: Mapped[str] = mapped_column(Text)
    recommendation_key: Mapped[Optional[str]] = mapped_column(String(32))
    recommendation_label: Mapped[Optional[str]] = mapped_column(String(80))
    recommendation_description: Mapped[Optional[str]] = mapped_column(Text)
    traffic_profile: Mapped[Optional[str]] = mapped_column(String(20))
    region_count: Mapped[Optional[int]] = mapped_column(Integer)
    observability_depth: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ArchitectureOutput(Base):
    __tablename__ = "architecture_outputs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("architecture_requests.id"))
    summary: Mapped[str] = mapped_column(Text)
    raw_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DiagramNode(Base):
    __tablename__ = "diagram_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    output_id: Mapped[int] = mapped_column(ForeignKey("architecture_outputs.id"))
    node_key: Mapped[str] = mapped_column(String(120))
    label: Mapped[str] = mapped_column(String(200))
    x: Mapped[int] = mapped_column(Integer)
    y: Mapped[int] = mapped_column(Integer)


class DiagramEdge(Base):
    __tablename__ = "diagram_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    output_id: Mapped[int] = mapped_column(ForeignKey("architecture_outputs.id"))
    source: Mapped[str] = mapped_column(String(120))
    target: Mapped[str] = mapped_column(String(120))


class CostEstimate(Base):
    __tablename__ = "cost_estimates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    output_id: Mapped[int] = mapped_column(ForeignKey("architecture_outputs.id"))
    service: Mapped[str] = mapped_column(String(160))
    assumption: Mapped[str] = mapped_column(Text)
    monthly_usd: Mapped[int] = mapped_column(Integer)


class SecurityFinding(Base):
    __tablename__ = "security_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    output_id: Mapped[int] = mapped_column(ForeignKey("architecture_outputs.id"))
    severity: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text)
    remediation: Mapped[str] = mapped_column(Text)


class IacTemplate(Base):
    __tablename__ = "iac_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    output_id: Mapped[int] = mapped_column(ForeignKey("architecture_outputs.id"))
    language: Mapped[str] = mapped_column(String(40))
    content: Mapped[str] = mapped_column(Text)
