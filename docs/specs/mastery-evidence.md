# Mastery Evidence and Compatibility

## Trust boundary

Soroban Dojo distinguishes three learner signals:

1. **Activity** records that a lesson, exercise, worksheet, game, or boss was used or completed.
2. **Accuracy** reports correct outcomes, including assisted corrections where the interface says so.
3. **First-check evidence** records a prospective, unassisted first submission against a versioned rule.

Pre-0.4 records remain useful activity, but they cannot become verified evidence because they do not retain enough attempt, reveal, recovery, or completion-source history.

## Attempt evidence v1

`soroban-dojo:mastery-evidence-v1` is a bounded array of attempts. Each attempt includes:

- a stable attempt and item ID
- source, level, and skill
- rule ID and rule version
- optional deterministic seed
- ordered submit, hint, reveal, recovery, or manual events

An attempt enters the evidence sample when it is the learner's first recorded exposure to that item, its first submission is non-empty, and no assistance event happened before it. The first submission may be correct or incorrect; both are needed for an honest accuracy denominator. A later correction, retry, replay, or stale-tab duplicate remains useful activity but cannot replace or multiply the first-check result. Reviewing a method after an already-correct first check does not revoke that evidence.

The browser retains at most 400 detailed evidence attempts. A separate monotonic v1 item-claim index remembers the first attempt ID for each exposed item, so eviction cannot make a retry prospective again. If that claim cannot be saved, the attempt receives activity credit only. Reset progress removes both records while preserving the display theme.

## Comparable scores v2

`soroban-dojo:minigame-scores-v2` stores results on a 0–100 scale:

```text
normalized = round(100 × correct targets / configured targets)
```

Results are comparable only within the same mode, tier, and rule version. Round points and streaks remain separate playful signals. Naturally completed rounds may update a best; stopped or interrupted rounds cannot. Legacy raw scores and medals remain in their original keys and are copied only into a clearly labelled legacy section—never compared numerically with v2 results and never used to unlock current tiers.

Comparable medal thresholds are bronze 60, silver 80, and gold 95.

## Boss provenance v1

`soroban-dojo:boss-provenance-v1` uses one explicit source:

- `playable` — completed through the built-in three-phase session
- `manual` — recorded by the learner as an offline clear
- `legacy-unknown` — completed before source tracking existed

Playable means completed in the interface under a named positive rule version; it does not claim unassisted mastery. Current playable and manual sources require a valid completion time. The completion flag is shown as current-source evidence only after its provenance write succeeds. Badges and certificates require the matching completion flag and must expose the source; malformed or absent provenance on a legacy completion falls back to “source unknown.”

## Additive migration

`soroban-dojo:state-schema` is written only after all companion keys are available. Migration is idempotent and retryable after blocked or partial writes. A current marker still strictly validates and recreates missing empty companions, while malformed companions keep initialization incomplete. A future marker remains opaque to this older client. In either uncertain case all learning-state writers become read-only rather than normalizing and overwriting unknown data. Migration never rewrites existing 0.3 keys, and the raw `soroban-dojo:theme` value remains byte-for-byte unchanged.

Challenge sessions are rebuilt only by their stored rule version. An unsupported future version remains preserved but displays “result unavailable” instead of silently changing its questions or outcome.
