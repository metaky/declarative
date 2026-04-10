<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/880cdadb-59a1-4aa7-9e3c-ba84df0ab380

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the full app locally:
   `npm run dev`
   This now starts both the Vite frontend and the Express API used by the translator.

### Local Development Modes

#### Real Gemini + Dev Bypass

Recommended for normal local work. Add this to [`.env.local`](/Users/kyle.wegner/Dev Projects/declarative/.env.local):

`DEV_BYPASS_CHALLENGE=true`

In this mode:
- `/api/translate` still runs through the local Express API and uses your local `GEMINI_API_KEY`
- `/api/challenge` returns a harmless dev response instead of requiring Redis
- production security stays unchanged because bypass mode is ignored when `NODE_ENV=production`

#### Real Gemini + Full Challenge Parity

If you want local behavior to match production more closely, leave `DEV_BYPASS_CHALLENGE` unset or set it to `false`, and provide:
- `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

In this mode:
- `/api/challenge` creates one-time challenge IDs in Redis
- `/api/translate` strictly requires a valid challenge ID
- you can verify the full production-style anti-abuse flow locally

#### Mock Translations Without Gemini

If you want to test the translator UI and raw API responses without a working Gemini key, add this to [`.env.local`](/Users/kyle.wegner/Dev Projects/declarative/.env.local):

`DEV_USE_MOCK_TRANSLATIONS=true`

Then restart `npm run dev`. In this mode:
- `/api/translate` returns deterministic mock suggestions
- the browser Translate flow still works end-to-end
- production is unaffected because mock mode is disabled when `NODE_ENV=production`

### Running Services Individually

- Frontend only: `npm run dev:client`
- API only: `npm run dev:api`

## Deploy Updates

1. Install Google Cloud CLI if you haven't already:
   `brew install --cask google-cloud-sdk`
2. Login to your Google account:
   `gcloud auth login`
3. Deploy directly using the defined npm script:
   `npm run deploy`
4. Ensure the Cloud Run service has valid runtime env vars configured for `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`.

## Troubleshooting & Known Issues

### The "Blank White Screen" After Deployment
If the live site suddenly starts showing a blank white screen immediately after deploying a new version, it is almost certainly a caching issue.

**The Cause:** In an SPA (Single Page Application) like Vite/React, each build generates newly hashed Javascript files (e.g. `index-[hash].js`). If the user's browser aggressively caches the old `index.html`, it will try to download the old JavaScript file which has been deleted from the server, resulting in a 404 and a white screen.

**The Fix:** We have explicitly set HTTP Headers inside `server.js` using `express` to force `Cache-Control: no-cache, no-store, must-revalidate` for `index.html`. **If any future developer or AI agent modifies `server.js`, they MUST retain these explicit headers, or the live site will break again.**
