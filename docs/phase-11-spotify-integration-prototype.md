# Phase 11 - Spotify Integration Prototype

## Objective
Add a local-first Spotify activity widget to public homepage with:
- currently playing track
- last played track
- album cover, artist, and Spotify link
- clear fallback states when no active track/session

This phase is client-side only (no backend) and keeps static-site compatibility for localhost.

## Files Added
- `app/assets/js/spotify-adapter.js`
- `app/assets/js/spotify-render.js`

## Files Updated
- `app/index.html`
- `app/assets/css/main.css`

## Implementation Summary

### 1. New Homepage Section: Spotify Activity
Added section `#spotify-activity` in `index.html` with:
- status line
- action buttons:
  - Connect Spotify
  - Refresh
  - Disconnect
- two result cards:
  - Currently Playing
  - Last Played
- local config panel:
  - Spotify Client ID input
  - Redirect URI input
  - Save Config button

### 2. Spotify Adapter (Auth + API)
`spotify-adapter.js` provides a reusable integration layer:
- local config management (`clientId`, `redirectUri`, `scopes`)
- OAuth Authorization Code with PKCE (browser-only)
- token persistence in localStorage
- token refresh using refresh token
- Spotify API calls:
  - `/me/player/currently-playing`
  - `/me/player/recently-played`
- normalized output methods:
  - `getCurrentlyPlaying()`
  - `getLastPlayed()`
  - `getActivity()`

### 3. Spotify Render Layer
`spotify-render.js` handles UI rendering and interaction:
- syncs config form from adapter
- saves local config to localStorage
- handles connect/refresh/disconnect actions
- renders track card metadata:
  - title
  - artist
  - album
  - played timestamp
  - open in Spotify link
- handles fallback and error states cleanly

### 4. Styling
Added scoped styles in `main.css`:
- widget card surface and border treatment
- track card layout and cover image style
- config panel style
- uses existing theme variables (`--accent-color`, `--surface-color`, etc.)

## Local Setup Notes
To activate the widget:
1. Create Spotify app in Spotify Developer Dashboard.
2. Copy Client ID.
3. Register exact Redirect URI used in local environment (example: `http://localhost:5500/index.html`).
4. Open homepage Spotify section.
5. Fill Client ID + Redirect URI in "Spotify Local Config".
6. Save Config, then click "Connect Spotify".

Required scopes used by prototype:
- `user-read-currently-playing`
- `user-read-recently-played`

## Local-First Storage
Spotify prototype stores data in localStorage:
- config key: `mrp_spotify_config_v1`
- token key: `mrp_spotify_auth_v1`
- PKCE/session helpers:
  - `mrp_spotify_pkce_verifier_v1`
  - `mrp_spotify_oauth_state_v1`

## Migration Readiness
Current architecture is prepared for VPS migration:
- adapter and renderer are separated
- API/auth logic isolated in adapter
- UI logic isolated in renderer
- backend can be introduced later without rewriting public section structure
