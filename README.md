# Nova Search

A responsive search homepage that displays web results inside its own interface rather than sending users to a search engine homepage. Search result links open in a new tab so Nova stays available.

## What is included

- `index.html` — page layout
- `styles.css` — responsive styling
- `app.js` — search experience and results rendering
- `functions/api/search.js` — Cloudflare Pages Function that fetches and parses DuckDuckGo's HTML search results
- `favicon.svg` — site icon

## Deploy to Cloudflare Pages

This project uses a Cloudflare Pages Function, so deploy it as a **Git-connected Pages project** (or a Pages Functions deployment) rather than a plain static drag-and-drop upload.

1. Put the contents of this folder at the root of a GitHub repository.
2. In Cloudflare, open **Workers & Pages** and create a **Pages** project connected to that repository.
3. Use no build command and set the build output directory to `.` (the repository root). There is no package install or build step.
4. Deploy. The `/functions/api/search.js` file provides the `/api/search` endpoint automatically.

If you already have a Pages project, copy these files into its root and redeploy. Keep the `functions` folder at the project root.

## How it works

The browser calls `/api/search?q=...` on the same site. The Cloudflare Function contacts DuckDuckGo, extracts up to 10 web results, and returns a small JSON response for Nova to render. It uses strict Safe Search and Australian English region settings. The query is sent to DuckDuckGo to retrieve results; this is not an independent web index.

## Limitations

- Because the endpoint uses DuckDuckGo's HTML results page rather than an official search API, its HTML markup may change and break parsing. Search requests can also be temporarily rate-limited by the provider.
- Clicking a result opens the destination website in a new tab. The search interface itself does not navigate to DuckDuckGo.
- This project is intended for Cloudflare Pages. Opening `index.html` directly from your computer will show the UI, but actual search requires the deployed `/api/search` Function.
