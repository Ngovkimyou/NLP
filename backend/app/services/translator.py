import os

import httpx
from fastapi import HTTPException

from app.models.schemas import (
    AmbiguousTerm,
    TranslationRequest,
    TranslationResponse,
)

DEEPL_API_URL = os.getenv("DEEPL_API_URL", "https://api-free.deepl.com/v2/translate")
DEEPL_API_KEY = os.getenv("DEEPL_API_KEY")

LANGUAGE_CODE_MAP = {
    "english": "EN",
    "chinese": "ZH",
    "japanese": "JA",
}

TONE_TO_FORMALITY = {
    "casual": "prefer_less",
    "polite": "prefer_more",
    "business": "prefer_more",
}

TONE_TO_INSTRUCTION = {
    "casual": "Use natural, conversational language suitable for a chat or message.",
    "polite": "Use polite and respectful language suitable for everyday communication.",
    "business": "Use formal, professional language suitable for workplace communication.",
}

FORMALITY_SUPPORTED_TARGETS = {"japanese"}


def detect_language(text: str, source_language: str) -> str:
    if source_language != "auto":
        return source_language

    # Simple placeholder detection until a real language detector is added.
    if any("\u3040" <= char <= "\u30ff" for char in text):
        return "japanese"
    if any("\u4e00" <= char <= "\u9fff" for char in text):
        return "chinese"
    return "english"


def get_ambiguous_terms(text: str) -> list[AmbiguousTerm]:
    ambiguous_terms = []
    lowered_text = text.lower()

    if "file" in lowered_text:
        ambiguous_terms.append(
            AmbiguousTerm(
                term="file",
                chosen_meaning="digital document",
                other_meanings=["paper folder", "official record"],
            )
        )
    if "meeting" in lowered_text:
        ambiguous_terms.append(
            AmbiguousTerm(
                term="meeting",
                chosen_meaning="work discussion",
                other_meanings=["social gathering"],
            )
        )

    return ambiguous_terms


def build_translation(payload: TranslationRequest) -> TranslationResponse:
    if not DEEPL_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Translation service is not configured. Please set DEEPL_API_KEY in the backend environment.",
        )

    detected_language = detect_language(payload.text, payload.source_language)
    request_body: dict[str, object] = {
        "text": [payload.text],
        "target_lang": LANGUAGE_CODE_MAP[payload.target_language],
        "model_type": "quality_optimized",
        "custom_instructions": [TONE_TO_INSTRUCTION[payload.tone]],
    }

    if payload.target_language in FORMALITY_SUPPORTED_TARGETS:
        request_body["formality"] = TONE_TO_FORMALITY[payload.tone]

    if payload.source_language != "auto":
        request_body["source_lang"] = LANGUAGE_CODE_MAP[payload.source_language]

    with httpx.Client(timeout=20.0) as client:
        response = client.post(
            DEEPL_API_URL,
            headers={
                "Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}",
                "Content-Type": "application/json",
            },
            json=request_body,
        )
        response.raise_for_status()

    data = response.json()
    translation_item = data["translations"][0]
    translated_text = translation_item["text"]
    detected_source = translation_item.get(
        "detected_source_language",
        LANGUAGE_CODE_MAP.get(detected_language, "EN"),
    )

    explanation = (
        "Translated with DeepL. Tone is guided using custom instructions, and"
        " formality is also applied when the target language supports it."
    )

    return TranslationResponse(
        detected_language={
            "EN": "english",
            "ZH": "chinese",
            "JA": "japanese",
        }.get(detected_source, detected_language),
        target_language=payload.target_language,
        tone=payload.tone,
        translation=translated_text,
        romanization=None,
        explanation=explanation,
        ambiguous_terms=get_ambiguous_terms(payload.text),
    )
