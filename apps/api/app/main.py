from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.architecture import router as architecture_router
from app.db.base import Base
from app.db.session import engine
from app.models.project import User

app = FastAPI(
    title="AI Architecture Copilot API",
    version="0.1.0",
    description="Generates Azure architecture reviews, diagrams, cost estimates, and IaC."
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)

    from app.db.session import SessionLocal

    with SessionLocal() as db:
        demo_user = db.query(User).filter(User.email == "demo@architecture.local").first()
        if demo_user is None:
            db.add(User(email="demo@architecture.local", password_hash="demo-user-placeholder"))
            db.commit()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(architecture_router, prefix="/api/architecture", tags=["architecture"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
