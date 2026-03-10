# Phase - Spotify Floating Widget

## Objective
Refactor Spotify activity from a regular page section into a global floating draggable widget for public pages.

## Scope Implemented
- Floating circular Spotify bubble (fixed/global).
- Draggable behavior across viewport (mouse and touch via pointer events).
- Snap-to-left/right behavior after drag.
- Position persistence in localStorage.
- Expandable floating panel on click.
- Panel content:
  - Currently Playing
  - Last Played
  - Album cover
  - Track title
  - Artist
  - Open in Spotify link
  - Refresh button
  - Connect/Disconnect controls
- No account/config input in widget UI (fixed account mode).
- Compact floating label next to bubble with current/last track summary.
- Auto refresh polling every 20 seconds.
- Fallback states:
  - not connected
  - no active track
  - load failed (with cache fallback)

## Storage Keys
- `mrp_spotify_widget_position_v1` (bubble position)
- `mrp_spotify_widget_open_v1` (panel open/close state)
- `mrp_spotify_widget_cache_v1` (last fetched activity)
- Existing Spotify auth/config keys from adapter remain unchanged.

## Files Added
- `app/assets/js/spotify-widget.js`
- `docs/phase-spotify-floating-widget.md`

## Files Updated
- `app/index.html`
- `app/projects.html`
- `app/knowledge.html`
- `app/ventures.html`
- `app/kom.html`
- `app/project-detail.html`
- `app/knowledge-detail.html`
- `app/portfolio-details.html`
- `app/service-details.html`
- `app/starter-page.html`
- `app/assets/css/main.css`

## Files Removed
- `app/assets/js/spotify-render.js` (replaced by widget-based rendering)

## Technical Notes
- Spotify API integration logic is preserved in `spotify-adapter.js`.
- Widget rendering is fully isolated in `spotify-widget.js`.
- UI uses existing theme variables from `main.css` to match public design system.
- Spotify access is locked to user ID `6q18z8t9g2c2v41522b3zjmxm`; other accounts are rejected on auth/refresh.
- Mobile behavior:
  - bubble remains draggable
  - panel switches to fixed bottom-sheet style for usability.

## Result
Spotify integration now behaves as a global floating mini media widget that is draggable, persistent, auto-refreshing, and visually consistent with the public website theme.
