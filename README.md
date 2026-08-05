# Apple Music Wrap

A static, client-side "Wrapped"-style deep dive into your **Apple Music library**. No backend, no build step — just HTML/CSS/JS you can open locally or host anywhere static files are served (GitHub Pages, Netlify, S3, etc.).

It intentionally leans on your **library** (songs, albums, artists, genres, decades) rather than pretending to be a year-in-review — the Apple Music API has no endpoint for historical top tracks by date range or total minutes listened the way Spotify's does. What it can do well is dig through everything you've saved and surface the shape of it: top genres, top artists, top albums, a decade breakdown, library size, total duration, and a few fun details — then generate a downloadable share card.

Everything runs in the browser via [MusicKit JS](https://developer.apple.com/documentation/musickitjs). The visitor signs into their own Apple Music account with a popup; your library data goes straight from Apple's API to the page and is never sent to any server.

## Try it without an Apple Developer account

Open `index.html` and click **Preview with sample data** — this renders the full Wrapped experience from a built-in mock dataset (`mock-data.js`) so you can review the design before setting up real credentials.

## Setting up real data

Connecting to a real library requires a **MusicKit developer token** — a JWT that identifies this app to Apple, signed with a private key from your Apple Developer account. This is separate from any visitor's personal Apple Music login.

### 1. Get an Apple Developer Program membership

Requires the paid tier ($99/year) — a free Apple ID account isn't enough for MusicKit access. Enroll at [developer.apple.com](https://developer.apple.com).

### 2. Create a MusicKit key

In [Certificates, Identifiers & Profiles → Keys](https://developer.apple.com/account/resources/authkeys/list):

1. Create a new key, enable the **MusicKit** capability.
2. Download the `.p8` private key file when prompted — Apple only lets you download it once.
3. Note the **Key ID** shown on the key's details page.
4. Note your **Team ID**, found on your account's [Membership page](https://developer.apple.com/account/#/membership).

### 3. Generate the developer token

This repo includes a small local script for this (it's a dev-time tool, not part of the deployed site):

```sh
npm install jsonwebtoken
node scripts/generate-token.js \
  --key ./AuthKey_XXXXXXXXXX.p8 \
  --keyId XXXXXXXXXX \
  --teamId XXXXXXXXXX
```

This prints a JWT valid for ~6 months (Apple's maximum).

### 4. Wire it into the site

Paste the printed token into [`config.js`](config.js):

```js
window.MUSICKIT_DEVELOPER_TOKEN = "eyJhbGciOi...";
```

Or, for quick local testing without editing files, leave `config.js` blank — the landing page will show a box to paste a token directly into the browser (stored in `localStorage` only).

> Since the token identifies your app rather than any individual user, avoid committing a real one to a public repository — token holders can call the Apple Music catalog API under your app's identity. For a personal/private deployment this is generally fine; for anything public, prefer the in-browser paste flow or keep the repo private.

### 5. Run it

Any static file server works, e.g.:

```sh
npx serve .
```

Open the printed URL, click **Connect Apple Music**, authorize, and it'll fetch your library (up to ~2,500 songs, paginated automatically) and build the Wrapped slides.

## Files

- `index.html` — markup / screens (landing, loading, wrapped slide deck)
- `style.css` — dark, gradient-forward styling
- `app.js` — MusicKit integration, library fetch + pagination, stat aggregation, slide rendering/navigation, share-card canvas export
- `config.js` — developer token + app metadata
- `mock-data.js` — sample dataset for the no-token preview
- `scripts/generate-token.js` — one-time developer token generator
