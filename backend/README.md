# Backend Setup

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

## Request Limits

- Translation text is limited to 100 characters.
- `POST /translate` is limited to 10 requests per minute per client.
