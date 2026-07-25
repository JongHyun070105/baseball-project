# ADR 0003: Authoritative gameplay intent replay and save schema 4

## Status

Accepted — 2026-07-24

## Context

Replay schema 2 stored `outcome` objects produced by React scene controllers for fielding and baserunning commands. That let presentation code supply `success`, `runs`, and `outs` to the domain reducer. The plate appearance had already applied its authoritative score and out changes, so a later presentation scene could apply them again. It also meant replay truth depended on UI-calculated results rather than raw player intent.

The command payload persisted inside save schema 3 therefore changed when presentation outcomes were removed.

## Decision

- Gameplay commands persist raw intent only:
  - fielder route, sprint state, and catch attempt
  - selected throw base and an explicit attempt marker
  - runner direction, sprint, slide state, and an explicit attempt marker
- The pure TypeScript match reducer derives deterministic scene terminal results with the match RNG.
- Infield catch state and accumulated movement route live in `MatchState`; releasing movement keys cannot erase the authoritative route.
- Presentation fielding scenes report success/failure for performance feedback but do not reapply score or outs already settled by the plate appearance.
- Baserunning remains authoritative game state and may advance a base, score one run, or record one out exactly once.
- A terminal match rejects all later gameplay commands so score, bases, outs, and the final hash remain immutable.
- Replay schema is bumped to 3 and save schema is bumped to 4.
- Save schemas 0–3 and replay schemas 1–2 remain importable.
- Legacy decision `outcome` objects must be structurally valid, are discarded as non-authoritative data, and the replay is rebuilt from its raw intent commands. Malformed legacy outcomes fail closed.
- Legacy decisions without an `outcome` are also rebuilt. They migrate with `attempt: false`; outcome-bearing runner commands migrate with `attempt: true` while preserving the original `slide` value.
- Independently checksummed backups from save schemas 2 and 3 remain recoverable even when the current payload or envelope checksum is corrupt.
- Historical resolved-game summaries and career records remain as originally awarded; replay normalization changes the embedded replay contract, not already displayed career history.
- New save schema 4 payloads reject unknown command keys, including injected `outcome` fields.

## Consequences

- UI and gameplay scene controllers can no longer forge or duplicate score/out mutations.
- Identical raw commands and seeds replay to identical terminal results, events, checkpoints, and final hashes.
- Existing local saves are rewritten into schema 4/replay schema 3 after successful checksum validation and deterministic reconstruction.
- The save migration and replay tests must remain part of the release gate.
