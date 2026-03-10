# Phase - Spotify Owner Auto Reconnect

## Objective
Refactor Spotify integration so it is strictly owner-bound, auto-reconnects after page refresh, and does not require manual login repeatedly after first authorization.

## Core Behavior Achieved
- First login uses Spotify Authorization Code + PKCE (client-side).
- Auth session is persisted in localStorage key `mrp_spotify_auth_v1`.
- On refresh/page load:
  - if access token is still valid, it is reused
  - if expired and refresh token exists, token is refreshed automatically
  - if refresh fails, widget moves to `token refresh failed` state
- Spotify account is hard-bound to owner user ID:
  - `allowed_spotify_user_id: 6q18z8t9g2c2v41522b3zjmxm`
  - non-owner account is rejected and local Spotify session is cleared

## Updated Files
- `app/assets/js/spotify-adapter.js`
- `app/assets/js/spotify-widget.js`

## Adapter Changes (`spotify-adapter.js`)
Added owner-bound config structure:
- `spotify_client_id`
- `redirect_uri`
- `required_scopes`
- `allowed_spotify_user_id`
- `allowed_display_name` (optional)

Implemented helper functions:
- `connectSpotify()`
- `disconnectSpotify()`
- `getStoredSpotifyAuth()`
- `refreshSpotifyToken()`
- `validateOwnerAccount()`
- `loadCurrentTrack()`
- `loadRecentlyPlayed()`

Additional functions:
- `restoreSpotifySession()` for auto-reconnect logic on page load
- `handleAuthCallback()` for PKCE callback handling and code exchange
- typed error codes for state-aware UI handling (unauthorized, refresh failed, disconnected)

Backward-compatible aliases retained for existing integration:
- `beginAuthFlow`, `disconnect`, `hasTokenRecord`, `getCurrentlyPlaying`, `getLastPlayed`

## Widget Changes (`spotify-widget.js`)
Kept floating draggable widget behavior and localStorage persistence for:
- widget position
- panel open/close state
- last activity cache

Implemented explicit UI states:
- `disconnected`
- `connecting`
- `connected`
- `unauthorized account`
- `no current track`
- `token refresh failed`

Widget data shown (owner only):
- currently playing
- last played
- title
- artist
- album cover
- open in Spotify link

Auto polling:
- 20 seconds interval for lightweight activity updates

## Notes
- `spotify-render.js` is not used in this architecture (widget-based rendering is active).
- Ensure `spotify_client_id` is set in `OWNER_SPOTIFY_CONFIG` (or `window.__SPOTIFY_OWNER_CONFIG__`) so first authorization can run.
