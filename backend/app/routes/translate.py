from fastapi import APIRouter

from app.models.schemas import TranslationRequest, TranslationResponse
from app.services.translator import build_translation

router = APIRouter(prefix="/translate", tags=["translate"])


@router.post("", response_model=TranslationResponse)
def translate(payload: TranslationRequest) -> TranslationResponse:
    return build_translation(payload)
