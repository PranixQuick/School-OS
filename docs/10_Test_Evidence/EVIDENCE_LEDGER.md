# Test Evidence Ledger

One row per verified claim. A row without a run URL is not evidence and should
be deleted rather than left standing as an assertion.

How to add a row: open the CI run, download the `test-results-<run_id>`
artifact, read `EVIDENCE_RUN.md`, and copy its commit SHA and run URL here
alongside the specific spec or test name that covers the item. See
`README_EVIDENCE.md` for what each artifact contains.

What does not count as evidence: a narrative note saying "all tests passed", a
self-reported execution log, a green tick with no artifact behind it, or a test
whose assertions cannot fail.

| Date (UTC) | Matrix item | Spec / test | Result | Commit | Run URL |
|---|---|---|---|---|---|
| (no verified entries yet) | | | | | |

## Why this file was empty

Before Phase 0 this ledger was a 343-byte template with placeholder brackets and
zero entries, `docs/PLAYWRIGHT/evidence_index.md` pointed at a directory that
contained no results, and `test-results/.last-run.json` held 45 bytes recording
only a status and an empty failure list. No date. No test list. No commit.
Meanwhile `docs/QA_EXECUTION_LOG.md` narrated five fix phases each claiming
"All tests passed", with no run output attached.

There was no artifact anywhere in the repository proving that any test had ever
passed on any given date. Phase 0.5 changed the CI workflow so every run now
emits a dated `EVIDENCE_RUN.md`, JUnit XML for both suites, an HTML report with
traces and video, and a coverage report, all retained for 30 days.

From here, a claim links to a run or it does not go in this file.
