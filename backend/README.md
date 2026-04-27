# Backend

This folder contains the FastAPI service for Smart Translator. It validates translation requests, calls DeepL, applies tone guidance, generates Pinyin or Romaji when relevant, and scans local meaning dictionaries for ambiguous terms.

For the full project overview, architecture, and contributor guide, see the root `README.md`.

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configure DeepL

Copy `.env.example` to `.env` and add your DeepL API key:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

```env
DEEPL_API_KEY=your_real_key_here
DEEPL_API_URL=https://api-free.deepl.com/v2/translate
```

If `DEEPL_API_KEY` is missing, the API returns a clear configuration error instead of translating.

## Run

```powershell
uvicorn app.main:app --reload
```

The API will run at `http://localhost:8000`.

## Endpoints

- `GET /`
- `GET /health`
- `POST /translate`

## Example Request

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8000/translate `
  -ContentType "application/json" `
  -Body '{"text":"Please file the bank note.","source_language":"auto","target_language":"japanese","tone":"polite"}'
```

## Request Limits

- Translation text is limited to 100 characters.
- `POST /translate` is limited to 10 requests per minute per client.

## Important Files

- `app/main.py`: FastAPI app setup, CORS, middleware, and routes.
- `app/routes/translate.py`: Translation route.
- `app/services/translator.py`: DeepL request building, language detection, romanization, and meaning lookup.
- `app/models/schemas.py`: Pydantic request and response models.
- `app/middleware/rate_limit.py`: In-memory request limiter.
- `app/data/meanings/`: Local ambiguous-term dictionaries.
- `api/index.py`: Vercel-compatible app export.

## Tests

```powershell
python -m unittest discover
```
