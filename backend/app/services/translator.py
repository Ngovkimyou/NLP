import json
import os
import re
from functools import lru_cache
from pathlib import Path

import httpx
from fastapi import HTTPException

from app.models.schemas import (
    AmbiguousTerm,
    TranslationRequest,
    TranslationResponse,
)

try:
    from pypinyin import Style, pinyin
except ImportError:  # pragma: no cover - optional dependency guard
    Style = None
    pinyin = None

try:
    import pykakasi
except ImportError:  # pragma: no cover - optional dependency guard
    pykakasi = None

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
_JAPANESE_ROMANIZER = None
PUNCTUATION_SPACING_PATTERN = re.compile(r"\s+([,.!?;:。！？、，；：])")
MEANINGS_DIR = Path(__file__).resolve().parents[1] / "data" / "meanings"
MEANING_LANGUAGE_FILE_MAP = {
    "english": "en.json",
    "chinese": "zh.json",
    "japanese": "ja.json",
}


def detect_language(text: str, source_language: str) -> str:
    if source_language != "auto":
        return source_language

    # Simple placeholder detection until a real language detector is added.
    if any("\u3040" <= char <= "\u30ff" for char in text):
        return "japanese"
    if any("\u4e00" <= char <= "\u9fff" for char in text):
        return "chinese"
    return "english"


def load_meaning_dictionary(language: str) -> dict[str, dict[str, object]]:
    filename = MEANING_LANGUAGE_FILE_MAP.get(language)
    if filename is None:
        return {}

    path = MEANINGS_DIR / filename
    if not path.exists():
        return {}

    return load_meaning_dictionary_from_file(language, path.stat().st_mtime_ns)


@lru_cache(maxsize=12)
def load_meaning_dictionary_from_file(
    language: str,
    modified_time: int,
) -> dict[str, dict[str, object]]:
    filename = MEANING_LANGUAGE_FILE_MAP.get(language)
    if filename is None:
        return {}

    path = MEANINGS_DIR / filename
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        return {}

    return data


def is_term_in_text(term: str, text: str, source_language: str) -> bool:
    if source_language == "english":
        return bool(re.search(rf"\b{re.escape(term.lower())}\b", text.lower()))

    return term in text


def find_term_spans(term: str, text: str) -> list[tuple[int, int]]:
    spans = []
    start = text.find(term)

    while start != -1:
        end = start + len(term)
        spans.append((start, end))
        start = text.find(term, start + 1)

    return spans


def get_ambiguous_terms(text: str, source_language: str) -> list[AmbiguousTerm]:
    dictionary = load_meaning_dictionary(source_language)
    ambiguous_terms = []
    occupied_spans: list[tuple[int, int]] = []
    dictionary_items = dictionary.items()

    if source_language != "english":
        dictionary_items = sorted(
            dictionary.items(),
            key=lambda item: len(item[0]),
            reverse=True,
        )

    for term, meanings in dictionary_items:
        if source_language == "english":
            found = is_term_in_text(term, text, source_language)
        else:
            spans = find_term_spans(term, text)
            found = any(
                not any(
                    start >= taken_start and end <= taken_end
                    for taken_start, taken_end in occupied_spans
                )
                for start, end in spans
            )

            if found:
                occupied_spans.extend(spans)

        if not found:
            continue

        chosen_meaning = meanings.get("chosen_meaning", "")
        other_meanings = meanings.get("other_meanings", [])

        if isinstance(chosen_meaning, str) and isinstance(other_meanings, list):
            ambiguous_terms.append(
                AmbiguousTerm(
                    term=term,
                    chosen_meaning=chosen_meaning,
                    other_meanings=other_meanings,
                )
            )

    return ambiguous_terms


def romanize_chinese(text: str) -> str | None:
    if pinyin is None or Style is None:
        return None

    syllables = pinyin(text, style=Style.TONE, heteronym=False, errors="default")
    romanized = " ".join(
        item[0].strip() for item in syllables if item and item[0].strip()
    )
    romanized = PUNCTUATION_SPACING_PATTERN.sub(r"\1", romanized)
    return f"Pinyin: {romanized}" if romanized else None


def romanize_japanese(text: str) -> str | None:
    global _JAPANESE_ROMANIZER

    if pykakasi is None:
        return None

    if _JAPANESE_ROMANIZER is None:
        _JAPANESE_ROMANIZER = pykakasi.kakasi()

    segments: list[str] = []
    sokuon_prefix = ""

    for token in _JAPANESE_ROMANIZER.convert(text):
        segment = token.get("hepburn", "").strip()
        if not segment:
            continue

        if sokuon_prefix:
            doubled_consonant = segment[0] if segment[0].isalpha() else ""
            segment = f"{sokuon_prefix}{doubled_consonant}{segment}"
            sokuon_prefix = ""

        if token.get("hira", "").endswith("っ") and segment.endswith("tsu"):
            sokuon_prefix = segment[:-3]
            continue

        segments.append(segment)

    if sokuon_prefix:
        segments.append(sokuon_prefix)

    romanized = PUNCTUATION_SPACING_PATTERN.sub(r"\1", " ".join(segments))
    return f"Romaji: {romanized}" if romanized else None


def build_romanization(text: str, target_language: str) -> str | None:
    if target_language == "chinese":
        return romanize_chinese(text)
    if target_language == "japanese":
        return romanize_japanese(text)
    return None


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
    source_language_name = {
        "EN": "english",
        "ZH": "chinese",
        "JA": "japanese",
    }.get(detected_source, detected_language)

    return TranslationResponse(
        detected_language=source_language_name,
        target_language=payload.target_language,
        tone=payload.tone,
        translation=translated_text,
        romanization=build_romanization(translated_text, payload.target_language),
        explanation=explanation,
        ambiguous_terms=get_ambiguous_terms(payload.text, source_language_name),
    )
