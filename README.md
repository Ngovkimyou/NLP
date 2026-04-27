# Smart Translator

Smart Translator is a school project for context-aware translation between English, Chinese, and Japanese. The app combines a polished Next.js frontend with a FastAPI backend that calls DeepL, applies tone guidance, adds Pinyin or Romaji when useful, and explains locally tracked ambiguous words.

The goal is to help users translate short text while also understanding possible meanings behind important words, not just receiving a plain translated sentence.

## What The Project Does

- Translates short text between English, Chinese, and Japanese.
- Supports automatic source-language detection for the three project languages.
- Lets users choose a translation tone: casual, polite, or business.
- Uses DeepL custom instructions to guide translation style.
- Adds DeepL formality settings when the target language supports it.
- Shows Pinyin for Chinese output and Romaji for Japanese output.
- Scans the original input against local meaning dictionaries and displays possible meanings for ambiguous terms.
- Keeps a local in-browser translation history for quick restore.
- Includes request limiting on the backend to avoid excessive translation calls.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, Pydantic, Uvicorn |
| Translation provider | DeepL API |
| HTTP client | httpx |
| Romanization | pypinyin for Chinese, pykakasi for Japanese |
| Testing | Python unittest |
| Deployment config | Vercel experimental services |

## Repository Structure

```text
.
|-- backend/
|   |-- api/
|   |   `-- index.py              # Vercel-compatible FastAPI export
|   |-- app/
|   |   |-- data/meanings/        # Local ambiguous-term dictionaries
|   |   |-- middleware/           # Rate limiting middleware
|   |   |-- models/               # Pydantic request/response schemas
|   |   |-- routes/               # API route definitions
|   |   |-- services/             # Translation and enrichment logic
|   |   `-- main.py               # FastAPI app setup
|   |-- tests/                    # Backend tests
|   |-- requirements.txt
|   `-- README.md
|-- frontend/
|   |-- app/
|   |   |-- globals.css           # Tailwind and global styles
|   |   |-- layout.tsx            # Metadata, font setup, app shell
|   |   `-- page.tsx              # Main translator UI and client logic
|   |-- public/
|   |-- package.json
|   `-- README.md
|-- vercel.json                  # Frontend/backend service routing
`-- README.md
```

## How The System Works

The frontend is a single-page translator interface. A user enters text, chooses source and target languages, selects a tone, and either waits for auto-translate or clicks the Translate button.

The frontend sends a `POST /translate` request to the backend. Locally, it calls `http://localhost:8000/translate`. In deployed Vercel environments, it uses the backend route prefix `/_/backend`.

The backend validates the request with Pydantic, applies rate limiting, detects the source language if needed, builds a DeepL request, and calls DeepL with the selected target language and tone instructions.

After DeepL returns the translation, the backend enriches the response by generating romanization for Chinese or Japanese output and scanning the original input against a local dictionary of ambiguous words.

The frontend renders the translation, romanization, meaning cards, copy buttons, and optional translation history.

## Data Flow

```text
User input
  -> frontend/app/page.tsx
  -> POST /translate
  -> backend/app/routes/translate.py
  -> backend/app/services/translator.py
  -> DeepL API
  -> romanization and meaning-dictionary enrichment
  -> TranslationResponse JSON
  -> frontend result panel
```

## Backend Design

The backend app is created in `backend/app/main.py`.

Main responsibilities:

- Load environment variables with `python-dotenv`.
- Create the FastAPI application.
- Register rate limiting for `POST /translate`.
- Register CORS for local development and Vercel preview deployments.
- Include the translation router.
- Expose health routes.

Important endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Basic service message |
| `GET` | `/health` | Health check |
| `POST` | `/translate` | Translate and enrich input text |

### Translation Request

```json
{
  "text": "Please file the bank note.",
  "source_language": "auto",
  "target_language": "japanese",
  "tone": "polite"
}
```

Allowed values:

- `source_language`: `auto`, `english`, `chinese`, `japanese`
- `target_language`: `english`, `chinese`, `japanese`
- `tone`: `casual`, `polite`, `business`
- `text`: 1 to 100 characters

### Translation Response

```json
{
  "detected_language": "english",
  "target_language": "japanese",
  "tone": "polite",
  "translation": "...",
  "romanization": "Romaji: ...",
  "explanation": "Translated with DeepL...",
  "ambiguous_terms": [
    {
      "term": "bank",
      "chosen_meaning": "financial institution",
      "other_meanings": ["river edge", "to rely on"]
    }
  ]
}
```

### Translation Service

Most backend behavior lives in `backend/app/services/translator.py`.

Key functions:

- `detect_language`: Detects English, Chinese, or Japanese from the input when source language is `auto`.
- `load_meaning_dictionary`: Loads the local JSON dictionary for the detected source language.
- `get_ambiguous_terms`: Finds dictionary terms in the original input.
- `romanize_chinese`: Builds Pinyin using `pypinyin`.
- `romanize_japanese`: Builds Romaji using `pykakasi`.
- `build_translation`: Validates configuration, calls DeepL, and returns the final response.

### Meaning Dictionaries

The local dictionaries are in `backend/app/data/meanings/`.

Files:

- `en.json` for English input.
- `zh.json` for Chinese input.
- `ja.json` for Japanese input.

Each entry follows this structure:

```json
{
  "word": {
    "chosen_meaning": "the default meaning to show first",
    "other_meanings": ["another possible meaning"]
  }
}
```

Matching behavior:

- English uses whole-word matching, so `bank` does not match `banking`.
- Chinese and Japanese use substring matching because words are not always separated by spaces.
- Chinese and Japanese terms are checked longest-first so longer terms win over smaller terms inside them.

### Rate Limiting

`backend/app/middleware/rate_limit.py` limits `POST /translate` to 10 requests per minute per client host. If the client exceeds the limit, the API returns HTTP `429` with a `Retry-After` header.

This middleware stores timestamps in memory, so it is simple and useful for this project. In a multi-instance production system, this would need shared storage such as Redis.

## Frontend Design

The frontend is implemented mostly in `frontend/app/page.tsx`.

Main UI features:

- Source language selector with auto-detect.
- Target language selector.
- Tone selector.
- Swap button.
- Auto-translate toggle with debounce.
- Manual Translate button.
- Input character counter and 100-character limit.
- Translation result panel.
- Pinyin or Romaji panel when available.
- Possible meanings panel.
- Translation history panel.
- Copy buttons for translation, romanization, and meanings.

### API Base URL Logic

The frontend chooses the backend URL in this order:

1. `NEXT_PUBLIC_API_URL`, if set.
2. `/_/backend`, when running outside localhost.
3. `http://localhost:8000`, for local development.

This lets local development run frontend and backend separately while deployed Vercel builds use the route prefix from `vercel.json`.

### State Management

The frontend uses React state directly because the app is small and self-contained.

Important state values:

- `sourceLanguage`, `targetLanguage`, `tone`: current translation options.
- `inputText`: text from the textarea.
- `result`: latest `TranslationResponse`.
- `isLoading` and `error`: request status.
- `autoTranslate`: controls debounce-based translation.
- `translationHistory`: stores up to 10 manually saved translations.
- `copyStatus`: shows short-lived copy feedback.

### Request Safety

The frontend uses `requestIdRef` to ignore stale responses. This matters when a user types quickly and multiple auto-translate requests are in flight at the same time.

## Local Development

You need both backend and frontend running.

### 1. Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env`:

```env
DEEPL_API_KEY=your_real_key_here
DEEPL_API_URL=https://api-free.deepl.com/v2/translate
```

Run the backend:

```powershell
uvicorn app.main:app --reload
```

The backend runs at `http://localhost:8000`.

### 2. Frontend Setup

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

### 3. Optional Frontend Environment

For local development, no frontend `.env` is required if the backend runs on port `8000`.

If the backend is somewhere else, set:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Testing And Quality Checks

Run backend tests:

```powershell
cd backend
python -m unittest discover
```

Run frontend linting:

```powershell
cd frontend
npm run lint
```

Build the frontend:

```powershell
cd frontend
npm run build
```

## Deployment Notes

The project includes `vercel.json` with two services:

- `frontend`: Next.js app served at `/`.
- `backend`: FastAPI app served at `/_/backend`.

The Vercel backend entry point is `backend/api/index.py`, which exports the FastAPI app as both `application` and `app`.

Production deployment needs `DEEPL_API_KEY` configured in the backend environment. Without it, the backend returns a clear HTTP `503` configuration error for translation requests.

## Common Contributor Tasks

### Add A New Ambiguous Word

1. Open the matching dictionary in `backend/app/data/meanings/`.
2. Add a top-level JSON entry.
3. Keep the value short enough for display cards.
4. Run backend tests.

Example:

```json
"case": {
  "chosen_meaning": "situation or example",
  "other_meanings": ["container", "legal matter", "grammar form"]
}
```

### Add A New Target Language

This is larger than adding dictionary data.

Places to update:

- Backend schema literals in `backend/app/models/schemas.py`.
- DeepL language mapping in `backend/app/services/translator.py`.
- Optional formality support in `FORMALITY_SUPPORTED_TARGETS`.
- Optional romanization support in `build_romanization`.
- Frontend language lists and type definitions in `frontend/app/page.tsx`.
- Tests for detection, dictionary matching, and UI behavior.

### Change Tone Behavior

Update these mappings in `backend/app/services/translator.py`:

- `TONE_TO_FORMALITY`
- `TONE_TO_INSTRUCTION`

Then update frontend tone labels and type definitions if adding or removing tone options.

## Known Limitations

- Translation text is intentionally limited to 100 characters.
- The meaning dictionaries are manually curated and are not full dictionaries.
- Auto language detection is simple script-based detection, not a full NLP classifier.
- Rate limiting is in-memory and resets when the backend process restarts.
- Translation requires a valid DeepL API key.

## Quick Start For New Members

1. Read this root README first.
2. Start the backend with `uvicorn app.main:app --reload`.
3. Start the frontend with `npm run dev`.
4. Try translating short text at `http://localhost:3000`.
5. Read `backend/app/services/translator.py` to understand the core backend logic.
6. Read `frontend/app/page.tsx` to understand the main UI flow.
7. Run `python -m unittest discover` before changing backend dictionary or language logic.
8. Run `npm run lint` before changing frontend code.

