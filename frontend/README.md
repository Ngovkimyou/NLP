# Frontend

This folder contains the Next.js UI for Smart Translator. It lets users enter short text, select source and target languages, choose tone, trigger translation, copy results, review possible meanings, and restore previous translations from local session history.

For the full project overview, architecture, and contributor guide, see the root `README.md`.

## Getting Started

Install dependencies:

```powershell
npm install
```

Run the development server:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The backend should also be running at `http://localhost:8000` unless you configure a different API URL.

## Environment

The frontend resolves the API base URL in this order:

1. `NEXT_PUBLIC_API_URL`, if set.
2. `/_/backend`, when deployed outside localhost.
3. `http://localhost:8000`, for local development.

Optional local `.env` example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Important Files

- `app/page.tsx`: Main translator UI, API calls, debounce behavior, copy controls, and translation history.
- `app/layout.tsx`: App metadata and font setup.
- `app/globals.css`: Tailwind import, theme variables, and global body styling.
- `package.json`: Next.js scripts and frontend dependencies.

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run start
```

## Implementation Notes

- The page is a client component because it manages text input, network requests, copy state, and local translation history.
- Auto-translate uses a short debounce to avoid sending a request on every keystroke.
- Stale responses are ignored with an incrementing request id.
- The UI enforces the same 100-character limit as the backend.
- Manual translations are saved to local React state history, capped at 10 items.
