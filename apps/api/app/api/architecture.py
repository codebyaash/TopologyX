from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.project import ArchitectureOutput as ArchitectureOutputModel
from app.models.project import ArchitectureRequest as ArchitectureRequestModel
from app.models.project import CostEstimate as CostEstimateModel
from app.models.project import DiagramEdge as DiagramEdgeModel
from app.models.project import DiagramNode as DiagramNodeModel
from app.models.project import IacTemplate as IacTemplateModel
from app.models.project import Project, SecurityFinding as SecurityFindingModel, User
from app.schemas.architecture import (
    ArchitectureRequest,
    ArchitectureOutput,
    ProjectCreate,
    ProjectDetail,
    ProjectSummary,
    RunContext,
    SavedArchitectureRun,
)
from app.services.architecture.generator import generate_architecture

router = APIRouter()


def _serialize_run(request_row: ArchitectureRequestModel, output_row: ArchitectureOutputModel) -> SavedArchitectureRun:
    run_context = None
    if request_row.recommendation_key and request_row.recommendation_label and request_row.recommendation_description and request_row.traffic_profile and request_row.region_count and request_row.observability_depth:
        run_context = RunContext(
            recommendationKey=request_row.recommendation_key,
            recommendationLabel=request_row.recommendation_label,
            recommendationDescription=request_row.recommendation_description,
            trafficProfile=request_row.traffic_profile,
            regionCount=request_row.region_count,
            observabilityDepth=request_row.observability_depth,
        )

    return SavedArchitectureRun(
        id=request_row.id,
        projectId=request_row.project_id,
        prompt=request_row.prompt,
        createdAt=request_row.created_at,
        output=ArchitectureOutput.model_validate_json(output_row.raw_json),
        runContext=run_context,
    )


def _persist_generation(db: Session, project_id: int, prompt: str, output: ArchitectureOutput, run_context: RunContext | None = None) -> None:
    request_row = ArchitectureRequestModel(
        project_id=project_id,
        prompt=prompt,
        recommendation_key=run_context.recommendationKey if run_context else None,
        recommendation_label=run_context.recommendationLabel if run_context else None,
        recommendation_description=run_context.recommendationDescription if run_context else None,
        traffic_profile=run_context.trafficProfile if run_context else None,
        region_count=run_context.regionCount if run_context else None,
        observability_depth=run_context.observabilityDepth if run_context else None,
    )
    db.add(request_row)
    db.flush()

    output_row = ArchitectureOutputModel(
        request_id=request_row.id,
        summary=output.summary,
        raw_json=output.model_dump_json(),
    )
    db.add(output_row)
    db.flush()

    for node in output.diagram.nodes:
        db.add(
            DiagramNodeModel(
                output_id=output_row.id,
                node_key=node.id,
                label=node.data.label,
                x=node.position.x,
                y=node.position.y,
            )
        )
    for edge in output.diagram.edges:
        db.add(
            DiagramEdgeModel(
                output_id=output_row.id,
                source=edge.source,
                target=edge.target,
            )
        )
    for item in output.costEstimate.items:
        db.add(
            CostEstimateModel(
                output_id=output_row.id,
                service=item.service,
                assumption=item.assumption,
                monthly_usd=item.monthlyUsd,
            )
        )
    for finding in output.securityFindings:
        db.add(
            SecurityFindingModel(
                output_id=output_row.id,
                severity=finding.severity,
                title=finding.title,
                detail=finding.detail,
                remediation=finding.remediation,
            )
        )
    db.add(IacTemplateModel(output_id=output_row.id, language="bicep", content=output.iac.bicep))
    db.add(IacTemplateModel(output_id=output_row.id, language="terraform", content=output.iac.terraform))
    db.commit()


@router.post("/projects", response_model=ProjectSummary)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProjectSummary:
    project = Project(user_id=user.id, name=payload.name, description=payload.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectSummary(
        id=project.id,
        name=project.name,
        description=project.description,
        userId=project.user_id,
        createdAt=project.created_at,
        latestRequestAt=None,
        requestCount=0,
    )


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[ProjectSummary]:
    rows = (
        db.query(
            Project.id,
            Project.name,
            Project.description,
            Project.user_id,
            Project.created_at,
            func.max(ArchitectureRequestModel.created_at).label("latest_request_at"),
            func.count(ArchitectureRequestModel.id).label("request_count"),
        )
        .outerjoin(ArchitectureRequestModel, ArchitectureRequestModel.project_id == Project.id)
        .filter(Project.user_id == user.id)
        .group_by(Project.id)
        .order_by(func.max(ArchitectureRequestModel.created_at).desc(), Project.created_at.desc())
        .all()
    )
    return [
        ProjectSummary(
            id=row.id,
            name=row.name,
            description=row.description,
            userId=row.user_id,
            createdAt=row.created_at,
            latestRequestAt=row.latest_request_at,
            requestCount=row.request_count,
        )
        for row in rows
    ]


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProjectDetail:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    history_rows = (
        db.query(ArchitectureRequestModel, ArchitectureOutputModel)
        .join(ArchitectureOutputModel, ArchitectureOutputModel.request_id == ArchitectureRequestModel.id)
        .filter(ArchitectureRequestModel.project_id == project_id)
        .order_by(ArchitectureRequestModel.created_at.desc())
        .all()
    )
    history = [_serialize_run(request_row, output_row) for request_row, output_row in history_rows]

    return ProjectDetail(
        id=project.id,
        name=project.name,
        description=project.description,
        userId=project.user_id,
        createdAt=project.created_at,
        latestRequestAt=history[0].createdAt if history else None,
        requestCount=len(history),
        history=history,
    )


@router.post("/generate", response_model=ArchitectureOutput)
def generate(
    request: ArchitectureRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional),
) -> ArchitectureOutput:
    output = generate_architecture(request.prompt)
    if request.projectId is not None:
        if user is None:
            raise HTTPException(status_code=401, detail="Login required to save a generated architecture")
        project = db.query(Project).filter(Project.id == request.projectId, Project.user_id == user.id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        _persist_generation(db, request.projectId, request.prompt, output, request.runContext)
    return output
