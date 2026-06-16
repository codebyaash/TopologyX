import json
import os
from typing import Any
from urllib import error, request


class AIConfigurationError(RuntimeError):
    pass


class AIRequestError(RuntimeError):
    pass


def is_ai_configured() -> bool:
    return bool(
        (os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_MODEL"))
        or (
            os.getenv("AZURE_OPENAI_API_KEY")
            and os.getenv("AZURE_OPENAI_ENDPOINT")
            and os.getenv("AZURE_OPENAI_DEPLOYMENT")
        )
    )


def complete_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    provider = _detect_provider()
    if provider == "openai":
        return _call_openai(system_prompt, user_prompt)
    if provider == "azure_openai":
        return _call_azure_openai(system_prompt, user_prompt)
    raise AIConfigurationError("No supported AI provider configuration found.")


def _detect_provider() -> str:
    if os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_MODEL"):
        return "openai"
    if os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_DEPLOYMENT"):
        return "azure_openai"
    raise AIConfigurationError("Missing AI provider environment variables.")


def _call_openai(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    api_key = os.environ["OPENAI_API_KEY"]
    model = os.environ["OPENAI_MODEL"]
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    response = _post_json(
        f"{base_url}/chat/completions",
        payload,
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIRequestError("OpenAI response did not include message content.") from exc
    return _extract_json(content)


def _call_azure_openai(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    api_key = os.environ["AZURE_OPENAI_API_KEY"]
    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"].rstrip("/")
    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    payload = {
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    response = _post_json(
        f"{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={api_version}",
        payload,
        {
            "api-key": api_key,
            "Content-Type": "application/json",
        },
    )
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIRequestError("Azure OpenAI response did not include message content.") from exc
    return _extract_json(content)


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=body, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise AIRequestError(f"AI provider returned HTTP {exc.code}: {detail}") from exc
    except error.URLError as exc:
        raise AIRequestError(f"Unable to reach AI provider: {exc.reason}") from exc


def _extract_json(content: Any) -> dict[str, Any]:
    if isinstance(content, list):
        text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    else:
        text = str(content)
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise AIRequestError("AI response did not contain JSON.")
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise AIRequestError("AI response contained invalid JSON.") from exc
