from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.architecture import router as architecture_router
from app.config import settings
from app.db.base import Base
from app.db.session import engine

app = FastAPI(
    title="AI Architecture Copilot API",
    version="0.1.0",
    description="Generates Azure architecture reviews, diagrams, cost estimates, and IaC."
)


@app.on_event("startup")
def startup() -> None:
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(architecture_router, prefix="/api/architecture", tags=["architecture"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
