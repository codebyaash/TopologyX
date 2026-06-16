import os
import tempfile
import unittest
from pathlib import Path

DB_DIR = tempfile.TemporaryDirectory()
DB_PATH = Path(DB_DIR.name) / "test_architecture.db"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"
os.environ["SESSION_SECRET"] = "test-session-secret"

from fastapi.testclient import TestClient

from app.main import app
from app.db.base import Base
from app.db.session import engine


class ArchitectureApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        DB_DIR.cleanup()

    def unique_email(self, label: str) -> str:
        return f"{label}-{self._testMethodName}@example.com"

    def register_and_login(self, label: str) -> dict:
        response = self.client.post(
            "/api/auth/register",
            json={
                "email": self.unique_email(label),
                "password": "Password123",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_register_create_project_generate_and_history(self) -> None:
        user = self.register_and_login("owner")
        self.assertEqual(user["email"], self.unique_email("owner"))

        project_response = self.client.post(
            "/api/architecture/projects",
            json={"name": "Claims Platform", "description": "Insurance workflow"},
        )
        self.assertEqual(project_response.status_code, 200, project_response.text)
        project = project_response.json()
        self.assertEqual(project["userId"], user["id"])

        generate_response = self.client.post(
            "/api/architecture/generate",
            json={
                "prompt": "Design an insurance claims processing workflow with FNOL intake, document uploads, fraud checks, adjuster assignment, policy lookup, secure customer communications, and payout approvals.",
                "projectId": project["id"],
                "runContext": {
                    "recommendationKey": "recommendation2",
                    "recommendationLabel": "Recommendation 2",
                    "recommendationDescription": "Cost-leaning alternative using the first substitute where available.",
                    "trafficProfile": "growth",
                    "regionCount": 2,
                    "observabilityDepth": "deep",
                },
            },
        )
        self.assertEqual(generate_response.status_code, 200, generate_response.text)
        generated = generate_response.json()
        self.assertEqual(generated["generationSource"], "deterministic")
        self.assertIn("generationNotes", generated)

        projects_response = self.client.get("/api/architecture/projects")
        self.assertEqual(projects_response.status_code, 200, projects_response.text)
        projects = projects_response.json()
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]["requestCount"], 1)

        detail_response = self.client.get(f"/api/architecture/projects/{project['id']}")
        self.assertEqual(detail_response.status_code, 200, detail_response.text)
        detail = detail_response.json()
        self.assertEqual(detail["requestCount"], 1)
        self.assertEqual(len(detail["history"]), 1)
        self.assertEqual(detail["history"][0]["prompt"], "Design an insurance claims processing workflow with FNOL intake, document uploads, fraud checks, adjuster assignment, policy lookup, secure customer communications, and payout approvals.")
        self.assertEqual(detail["history"][0]["output"]["generationSource"], "deterministic")
        self.assertEqual(detail["history"][0]["runContext"]["recommendationKey"], "recommendation2")
        self.assertEqual(detail["history"][0]["runContext"]["regionCount"], 2)

    def test_project_endpoints_require_authentication(self) -> None:
        unauthenticated_client = TestClient(app)
        try:
            response = unauthenticated_client.get("/api/architecture/projects")
            self.assertEqual(response.status_code, 401, response.text)
        finally:
            unauthenticated_client.close()

    def test_project_access_is_scoped_to_owner(self) -> None:
        owner_client = TestClient(app)
        outsider_client = TestClient(app)
        try:
            owner_email = self.unique_email("owner-scope")
            outsider_email = self.unique_email("outsider-scope")

            owner_register = owner_client.post(
                "/api/auth/register",
                json={"email": owner_email, "password": "Password123"},
            )
            self.assertEqual(owner_register.status_code, 200, owner_register.text)

            project_response = owner_client.post(
                "/api/architecture/projects",
                json={"name": "Private Project", "description": "Owner only"},
            )
            self.assertEqual(project_response.status_code, 200, project_response.text)
            project = project_response.json()

            outsider_register = outsider_client.post(
                "/api/auth/register",
                json={"email": outsider_email, "password": "Password123"},
            )
            self.assertEqual(outsider_register.status_code, 200, outsider_register.text)

            detail_response = outsider_client.get(f"/api/architecture/projects/{project['id']}")
            self.assertEqual(detail_response.status_code, 404, detail_response.text)
        finally:
            owner_client.close()
            outsider_client.close()


if __name__ == "__main__":
    unittest.main()
