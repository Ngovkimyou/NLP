from typing import Literal

from pydantic import BaseModel, Field


Language = Literal["auto", "english", "chinese", "japanese"]
TargetLanguage = Literal["english", "chinese", "japanese"]
Tone = Literal["casual", "polite", "business"]


class TranslationRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Text to translate.",
    )
    source_language: Language = "auto"
    target_language: TargetLanguage
    tone: Tone = "polite"


class AmbiguousTerm(BaseModel):
    term: str
    chosen_meaning: str
    other_meanings: list[str] = Field(default_factory=list)


class TranslationResponse(BaseModel):
    detected_language: TargetLanguage | Literal["english", "chinese", "japanese"]
    target_language: TargetLanguage
    tone: Tone
    translation: str
    romanization: str | None = None
    explanation: str
    ambiguous_terms: list[AmbiguousTerm] = Field(default_factory=list)
