# Privacy and Data

## Default posture

- no account or sign-in required
- no hidden analytics, advertising tracker, or remote progress API
- all learning progress stored in the current browser
- explicit reset control on the Progress page

## Stored locally

Soroban Dojo may store:

- selected learner path (`children` or `adults`) and its independent choose/clear controls
- completed lessons and exercise review states
- practice sessions and bounded timer history
- worksheet sessions and weekly study-plan state
- placement answers and recommendation
- naturally completed mini-game best scores and medals; session settings, stopped partial results, and Bead Builder's in-progress rod state are not persisted
- prospective first-check evidence, including whether a hint, reveal, recovery, or manual action happened before the first check, plus a monotonic item-claim index that prevents retries from becoming new evidence
- comparable mini-game results stored separately from legacy raw scores
- boss-round, active boss-session, badge, certificate, and playable/offline/legacy completion-source state
- one display-theme preference under `soroban-dojo:theme`: the raw identifier `washi`, `sakura`, or `sumi`

The canonical key registry is `src/lib/storage.js`. New browser state must be added there and covered by reset tests before release.

The learner path intentionally keeps its legacy raw-string storage format, while placement remains JSON in its compatible legacy/current shapes. Reading either value must not normalize or rewrite saved bytes. Only an explicit choose, score, clear, or reset action may change those records, and a failed browser write or removal must leave the prior saved state visible and protected.

Context-aware next actions are computed on-device from the existing route, placement, lesson, exercise, practice-session, and weekly-plan records. Rendering a recommendation does not write, migrate, or normalize those records. A legacy or stale weekly plan remains readable on its own page but is promoted elsewhere only after an explicit plan update stores a continuity key matching the current local inputs. Resume links contain only an allowlisted exact local session identifier and never send it to a remote service.

Soroban Dojo does not infer verified mastery from pre-0.4 records because those records do not contain enough attempt or assistance history. Existing records remain visible as legacy activity. New evidence uses parallel versioned keys and does not rewrite the old records or the raw theme preference. If a 0.4 versioned evidence, score, or provenance companion cannot be validated, or the schema marker names a newer version, the compatibility layer disables learning-state writes rather than overwriting those unknown records. Other malformed local records retain their safe read-time fallbacks.

## Reset contract

“Reset progress” removes every learning and reward key listed above, including route, placement, and game records. Route controls may clear only the selected path, and placement controls may clear only the saved starting point or its answers, without erasing other progress. Full reset preserves the display theme and unrelated browser data, and notifies other open Dojo tabs to reload. If cross-tab notification is unavailable, the learner receives a manual-reload warning. A missing, invalid, or inaccessible theme value falls back to Washi and never blocks the page. Some pages may immediately construct an unsaved default recommendation after reset; that default is not prior learner history.

## Disclosure

The public Privacy page must match this document. If analytics, accounts, sync, or any remote data transport are introduced later, they require an explicit specification and visible disclosure before shipping.
