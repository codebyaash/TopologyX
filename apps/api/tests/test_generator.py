import unittest
from unittest.mock import patch

from app.services.ai.client import AIRequestError
from app.services.architecture.generator import architecture_is_consistent, build_deterministic_architecture, generate_architecture


PROMPT = "Design a CRM platform for sales and customer success with tenant isolation, lead ingestion, workflow automation, reporting dashboards, audit logs, and role-based access."


class ArchitectureGeneratorTestCase(unittest.TestCase):
    def test_generate_architecture_uses_deterministic_mode_when_ai_is_not_configured(self) -> None:
        output = generate_architecture(PROMPT)
        self.assertEqual(output.generationSource, "deterministic")
        self.assertIn("deterministic architecture engine", output.generationNotes[0])
        self.assertGreater(len(output.services), 0)
        self.assertGreater(len(output.securityProfile.policyRecommendations), 0)
        self.assertGreater(len(output.iacStructure.modules), 0)
        self.assertEqual(output.iacStructure.deploymentOrder[0], "foundation")

    def test_generate_architecture_accepts_ai_validated_output(self) -> None:
        baseline = build_deterministic_architecture(PROMPT)
        ai_candidate = baseline.model_copy(deep=True)
        ai_candidate.generationSource = "ai"
        ai_candidate.generationNotes = ["AI refined service justification and workload fit."]
        ai_candidate.summary = "AI-enhanced architecture summary."

        with patch("app.services.architecture.generator.is_ai_configured", return_value=True), patch(
            "app.services.architecture.generator.complete_json",
            return_value=ai_candidate.model_dump(),
        ):
            output = generate_architecture(PROMPT)

        self.assertEqual(output.generationSource, "ai")
        self.assertEqual(output.summary, "AI-enhanced architecture summary.")
        self.assertEqual(output.generationNotes, ["AI refined service justification and workload fit."])

    def test_generate_architecture_falls_back_when_ai_response_fails(self) -> None:
        with patch("app.services.architecture.generator.is_ai_configured", return_value=True), patch(
            "app.services.architecture.generator.complete_json",
            side_effect=AIRequestError("provider timeout"),
        ):
            output = generate_architecture(PROMPT)

        self.assertEqual(output.generationSource, "deterministic")
        self.assertIn("AI generation was configured but unavailable or invalid", output.generationNotes[0])
        self.assertIn("Returned to the deterministic architecture engine", output.generationNotes[1])

    def test_generate_architecture_falls_back_when_ai_output_is_internally_inconsistent(self) -> None:
        baseline = build_deterministic_architecture(PROMPT)
        ai_candidate = baseline.model_copy(deep=True)
        ai_candidate.generationSource = "ai"
        ai_candidate.costEstimate.monthlyUsd = ai_candidate.costEstimate.monthlyUsd + 999

        with patch("app.services.architecture.generator.is_ai_configured", return_value=True), patch(
            "app.services.architecture.generator.complete_json",
            return_value=ai_candidate.model_dump(),
        ):
            output = generate_architecture(PROMPT)

        self.assertEqual(output.generationSource, "deterministic")
        self.assertIn("AI generation was configured but unavailable or invalid", output.generationNotes[0])

    def test_healthcare_prompt_gets_healthcare_security_pack(self) -> None:
        output = generate_architecture(
            "Design a HIPAA-compliant EHR platform handling 1M requests/day with private patient records, audit logging, backups, and secure provider access."
        )
        self.assertIn("HIPAA", output.securityProfile.compliancePacks)
        self.assertIn("PHI Handling", output.securityProfile.compliancePacks)

    def test_deterministic_output_passes_internal_consistency_checks(self) -> None:
        output = build_deterministic_architecture(PROMPT)
        self.assertTrue(architecture_is_consistent(output))


if __name__ == "__main__":
    unittest.main()
