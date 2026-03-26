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
