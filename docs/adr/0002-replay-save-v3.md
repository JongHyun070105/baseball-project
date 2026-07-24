# ADR 0002: Replay schema 2 and save schema 3

## Status

Accepted — 2026-07-24

## Context

Replay checkpoints originally used schema 1. A later exact-once change added `initialCommandId` to the persisted replay contract without changing that schema number. Replay restoration also verified only the final match-state hash. A modified intermediate event or checkpoint (including its recorded ball snapshot) could therefore survive structural validation when the final hash was unchanged.

Save schema 2 can exist in two envelope forms: the original envelope without `backupChecksum`, and the later envelope with an independently authenticated backup. Both forms may contain a replay schema 1 payload with no `initialCommandId`.

## Decision

- Replay bundles use schema 2. `initialCommandId` is required and represents the command id immediately before the first recorded command.
- Replay restoration regenerates the match and compares the recorded event array and every checkpoint byte-for-byte using their JSON representation, in addition to checking `finalHash`. Ball state is part of a checkpoint and is therefore covered by the same comparison.
- Save envelopes and career saves use schema 3.
- Import verifies a schema-2 envelope and its optional independent backup checksum against the original payload before migration.
- Schema-2 current and backup saves are normalized independently to schema 3. Embedded replay schema 1 is normalized to schema 2; a missing `initialCommandId` becomes `0`.
- Existing schema-0 and schema-1 save migrations remain supported and produce the same schema-3/replay-schema-2 representation.
- New writes always emit save schema 3 and replay schema 2. Unsupported future versions remain fail-closed.

## Consequences

Old local saves and exported JSON remain importable, including early schema-2 envelopes without `backupChecksum`. Successful import rewrites them into one current representation with a newly calculated envelope checksum and independent backup checksum. Replay data that cannot reproduce its events, checkpoints, ball snapshots, and final state is rejected as malformed rather than partially trusted.
