# Testing contract

The Playwright suite treats visible behavior as the contract. Tests use `data-testid` only for stable application boundaries and controls; text, CSS classes, and DOM nesting may change without rewriting the suite.

## Required test IDs

| Screen or control | `data-testid` | Expected behavior |
|---|---|---|
| App root | `app-shell` | Visible after the application has booted |
| Title | `title-screen` | Contains the new/resume controls |
| New career | `new-game-button` | Opens career creation |
| Resume | `resume-game-button` | Disabled without a valid save; opens the saved hub otherwise |
| Creation | `create-screen` | Wraps the full creation view |
| Name | `player-name-input` | Native text input |
| Hitter role | `role-hitter` | Selects the hitter role |
| Shortstop | `position-SS` | Selects shortstop |
| School | `school-option` | Repeated once per selectable school |
| Create | `create-career-button` | Persists the career and opens the hub |
| Hub | `career-hub` | Wraps the career hub |
| Player name | `player-name-display` | Displays the saved name exactly |
| Return to title | `return-to-title-button` | Leaves the save intact |
| Start game | `start-game-button` | Opens a playable scene |
| Game | `game-screen` | Wraps the active game view |
| Finish game | `finish-game-button` | Deterministic compressed-game control; opens results |
| Result | `result-screen` | Wraps postgame results |
| Return to hub | `return-to-hub-button` | Persists results and opens the hub |
| Advance month | `advance-month-button` | Advances exactly one compressed career month |
| Career year | `career-year` | Displays the current year |
| Draft | `draft-screen` | Visible after month 36 |
| Export | `export-save-button` | Downloads the current save as a file |
| Import | `import-save-input` | Native `input[type=file]` accepting an exported save |
| Import success | `import-save-success` | Visible only after validation and persistence succeed |

## Save management selectors

The save-slot UI exposes three independent slots and confirms destructive actions before mutating storage. Preserve these contracts so overwrite, delete, and restore flows remain decoupled from Korean copy and DOM nesting:

| Control | `data-testid` | Expected behavior |
|---|---|---|
| Save management | `manage-saves-button` | Opens the three-slot management screen |
| Save slot | `save-slot-{1|2|3}` | Wraps one and only one numbered slot |
| Select slot | `select-save-slot-{1|2|3}` | Opens an occupied slot or selects an empty slot for creation |
| Overwrite slot | `overwrite-save-slot-{1|2|3}` | Opens overwrite confirmation |
| Delete slot | `delete-save-slot-{1|2|3}` | Opens delete confirmation; it must not delete immediately |
| Restore slot | `restore-save-slot-{1|2|3}` | Opens backup-restore confirmation when a backup exists |
| Confirmation | `save-confirm-dialog` | Identifies the selected slot and pending action |
| Confirm deletion | `confirm-delete-save-slot` | Deletes only the selected slot |
| Cancel deletion | `cancel-delete-save-slot` | Leaves every slot byte-for-byte unchanged |

Pitcher creation is currently covered through accessible group/button names. Stable `role-pitcher`, `position-starter`, and `position-reliever` IDs are recommended if those visible labels become copy-editable.

`finish-game-button` and `advance-month-button` are product controls for the compressed local experience, not Playwright-only globals. If the final UX replaces them, preserve these IDs on the equivalent user-facing controls.

## Commands

```sh
npm run setup:browsers
npm run test:e2e
npm run test:visual
npm run test:performance
```

Visual tests run at 1440 x 900, dark color scheme, and reduced motion. The Chromium project repeats the viewport after the Desktop Chrome device preset so the preset cannot silently replace it with 1280 x 720. Create or refresh approved baselines only after reviewing the rendered screens:

```sh
npm run test:visual -- --update-snapshots
```

Do not commit failure artifacts from `test-results/` or `playwright-report/`. A failing console-error guard is actionable: fix the application error rather than filtering it in the fixture.

The local performance gate runs at 1440 × 900 on system Chrome. It creates a deterministic authoritative contact with the real batting input, verifies that the domain-owned ball is present in both the match-state contract and the visible WebGL scene, warms the representative night game for 10 seconds, then samples animation frames for 60 seconds with 18 animated athletes and 800 instanced spectators. The release thresholds are median frame time ≤ 20 ms, average ≥ 50 fps, p95 ≤ 33 ms, and JavaScript heap ≤ 350 MiB when Chrome exposes heap telemetry. A separate CPU-throttled slow-frame scenario must switch the high-quality 1.5 DPR scene to the medium-quality 1.13 DPR fallback. This is a regression alarm rather than a cross-device benchmark.
