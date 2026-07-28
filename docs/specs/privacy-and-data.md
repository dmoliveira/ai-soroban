# Privacy and Data

## Default posture

- no account or sign-in required
- no hidden analytics, advertising tracker, or remote progress API
- all learning progress stored in the current browser
- explicit reset control on the Progress page

## Stored locally

Soroban Dojo may store:

- selected learner path
- completed lessons and exercise review states
- practice sessions and bounded timer history
- worksheet sessions and weekly study-plan state
- placement answers and recommendation
- mini-game scores and medals
- boss-round, active boss-session, badge, and certificate state
- a display-theme preference

The canonical key registry is `src/lib/storage.js`. New browser state must be added there and covered by reset tests before release.

## Reset contract

“Reset progress” removes every learning and reward key listed above, including placement and game records. It preserves the display theme and unrelated browser data. Some pages may immediately construct an unsaved default recommendation after reset; that default is not prior learner history.

## Disclosure

The public Privacy page must match this document. If analytics, accounts, sync, or any remote data transport are introduced later, they require an explicit specification and visible disclosure before shipping.
