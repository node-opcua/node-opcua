# @sterfive/parallel-runner — Parallel Test Runner

A production-ready parallel mocha runner: per-file caching, checkpoint/resume,
git-aware selection, a true two-window TTY layout, and smart ETA — packaged as a
workspace tool in `tools/parallel-runner/` (`src/cli.js` + `terminal_screen.js`,
`src/cache.js`, `src/git_aware.js`, `src/worker.js`).

Read this doc in a pager:

```bash
parallel-runner --doc        # rendered + `less -R` on a TTY, plain text in CI
```

---

## Quick start

```bash
# from the repo root (tests live under packages/)
parallel-runner --root packages                  # run everything (cache-aware)
parallel-runner --root packages --gitAware       # only packages affected by git changes
parallel-runner --root packages --status         # cache / checkpoint / git status, run nothing
parallel-runner --help                           # all flags
parallel-runner --doc                            # this document, nicely rendered

# or directly
node tools/parallel-runner/src/cli.js --root packages

# in a single package: cd packages/node-opcua-client && parallel-runner
```


## Flags

| Flag | Description |
|------|-------------|
| `-f, --fileFilter <regex>` | only test files whose path matches |
| `-t, --testFilter <regex>` | only tests whose title matches |
| `-v, --verbose` | multi-line per-test output (disables the compact footer) |
| `--status` | print cache + checkpoint + git status and exit |
| `--reset` | wipe the cache, run everything from scratch |
| `--gitAware` | only test packages touched by git changes (plus dependents) |
| `--all` | ignore git-aware filtering |
| `--noStop` | don't stop at the first failure — collect all failures, report at the end |
| `--onlyFail` | re-run only the files that failed last time |
| `--doc` | show this documentation (paged through `less` on a TTY) |
| `--root <dir>` | root directory to scan for tests (default: cwd); state files land there |
| `-h, --help` | help |

## Environment variables

| Var | Default | Meaning |
|-----|---------|---------|
| `CPU` | auto | force N worker threads |
| `MIN_WORKER_COUNT` | 5 | floor for the auto worker count (capped by core count) |
| `CPU_FORMULA_FACTOR` | 0.9 | `round(cores * factor)` worker heuristic |
| `PING` | 600000 | watchdog tick in ms (dumps running tests + their logs) |
| `FORCE_TTY=1` / `FORCE_CI=1` | off | override TTY/CI detection (testing) |

## The two-window TTY layout

On a terminal, `terminal_screen.js` installs a VT100 scroll region
(`DECSTBM`, `ESC[top;bottom r`) so the screen is split in two:

```
┌──────────────────────────────────────────────────────┐
│  SCROLL WINDOW   test output scrolls here, any        │
│  console.log / worker stdout lands here safely       │
├──────────────────────────────────────────────────────┤
│  FOOTER (2 fixed lines, repainted in place)           │
│  ▊ 00:08.7 |█▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏▏| 36/708 6% ETA 3 min │
│  running 11: test_server.ts 45s | test_alarms.ts 12s … │
└──────────────────────────────────────────────────────┘
```

The invariant: **outside the footer painter the cursor always stays inside the
scroll window**, so test output can never clobber the progress footer. The footer
is repainted every 500 ms and shows the CPU gauge, elapsed, progress bar, file and
test counts, ETA, and the list of files currently running (old/hung ones in red).

At the end the footer is torn down and replaced by the one-line verdict:

```
[✓ ALL TESTS PASSED] (261 tests, 00:08.770)     ← green
[✗ 3 TESTS FAILED]  (261 tests, 00:08.770)      ← red
```

then the full synthetic report (totals, skipped breakdown, duration, failing
tests, longest tests) is printed in the scroll window.

In **CI** (no TTY, `CI=true`, `GITHUB_ACTIONS`, `TERM=dumb`, …) cursor control is
impossible, so each test line is prefixed instead:

```
[ETA 3 min   6% ▊]   ✓ verifyArguments - One UInt32
```

and the final verdict is printed on its own line without the ETA prefix.

Each test line starts with a single-width status icon so titles stay aligned:
`✓` passed, `✗` failed, `○` pending (`it.skip`).

## ETA

The ETA is not `(elapsed / done) * remaining`. Each file's wall time is measured
(`TEST_FILE_STARTED → TEST_FILE_COMPLETED`) and persisted in
`.parallel_test_durations.json`. Remaining work = sum of expected times of files
not started yet + residual of running ones, divided by the worker count, and never
less than the longest single residual. Expectations are rescaled by how fast this
run is going compared to history; unseen files are priced at the average.

## Cache, checkpoint, resume

- `.parallel_test_cache.json` (format 3.0) records one verdict per test file,
  written when the file is over: **passed** only if no test or hook in it failed.
- A cached pass is keyed on a fingerprint of everything the result depends on:
  the test file, its package's sources (git blob hashes of tracked files plus
  modified/untracked ones), the same for every workspace package it depends on
  (transitively), and repo-level config (lockfile, root tsconfig, `.mocharc`).
  Editing `node-opcua-utils/source/x.ts` therefore re-runs the utils tests and
  every package that depends on utils. Git-ignored files (`dist/`, `tmp/`,
  generated certificates) do not count. Committing changes the fingerprint
  once, so the first run after a commit re-runs the affected files.
- Files whose cached pass is still valid are **skipped**. With `--testFilter`
  nothing is skipped and nothing is recorded as passed (only a subset ran).
- Caches written by older versions are discarded on the first run.
- **Resume** is the cache: after a failure or CTRL+C, the next run skips the
  files that passed and re-runs everything else (the failing file, files that
  never ran, files that were running when you interrupted).
- **CTRL+C** is intercepted (raw-mode keypress + SIGINT): it records where the
  run stopped (shown by `--status`), terminates the workers (2 s grace) and
  exits 130. A second CTRL+C force-exits.
- The failing-tests list is kept up to date in every mode (not only
  `--noStop`); `--onlyFail` re-runs the files in it. Entries for files that
  were not re-run are carried over.
- A file that cannot be loaded (syntax error, broken import), a failing hook and
  a worker that dies (OOM, `process.exit` in a test) all count as failures.
- Exit code: `1` if anything failed (also with `--noStop`), `0` otherwise,
  `130` on CTRL+C.

## Git-aware mode

`--gitAware` maps changed files (modified/staged/untracked under `packages/`) to
their package via the nearest `package.json`, builds the inter-package dependency
graph, and keeps changed packages **plus all transitive dependents**. Everything
else is skipped and reported. A change to a repo-level config file (lockfile,
root `package.json`, `tsconfig*.json`, `.mocharc*`) runs everything. Without `--since` it only sees
uncommitted changes: on a clean checkout (typically CI) it runs everything.

`-g --since <ref>` (`--since` alone implies `-g`) compares against a reference
commit instead, e.g. `master`, `origin/master`, a tag or a sha. It takes what
changed between the merge-base of `<ref>` and `HEAD` and the working tree
(commits on your branch, staged and unstaged edits, deletions), plus untracked
files. Using the merge-base means commits that only landed on `<ref>` after you
branched are not counted. An unknown `<ref>` stops the run with exit code 2.
`--status --since <ref>` shows what would be selected.

```bash
parallel-runner -g --since master          # local branch vs master
parallel-runner -g --since origin/master   # in CI (fetch enough history first)
```
With `--root` pointing at a single package it runs all of that package's tests.

```
✓ Git-aware mode enabled - filtering to 30 affected packages
✓ 96 files skipped (git-aware)
```

Use `--all` to override. `--status` shows the same analysis without running.

## Interactive keys (TTY, raw mode)

| Key | Action |
|-----|--------|
| `Ctrl+C` | graceful shutdown + checkpoint save |
| `l` | list currently running test files |
| `i` | list running files **and** their captured logs |
| `h` | key help |

## Files

| File | Role |
|------|------|
| `src/cli.js` | main runner (bin `parallel-runner`): args, cache/git wiring, workers, footer, epilogue, SIGINT |
| `src/terminal_screen.js` | two-window TTY layout (scroll region + fixed footer), CI fallback |
| `src/worker.js` | worker thread: mocha reporter, captures stdout/stderr per file |
| `src/mocha_runner.js` | loader hooks (type stripping / dist redirect) + `runtests` |
| `src/discover.js` | test discovery under `--root` (`<root>/test`, `<root>/*/test`) |
| `src/cache.js` | cache 3.0: per-file verdict keyed on a fingerprint, checkpoint, failing list |
| `src/fingerprint.js` | what a cached pass depends on: test file + package sources + workspace deps + repo config |
| `src/git_aware.js` | git change analysis + dependency graph |
| `<root>/.parallel_test_cache.json` / `.parallel_test_durations.json` | state, written into `--root` (git-ignored via `.para*.json`) |

Backward compatibility: `packages/parallel_test.js` is a one-line shim that
forwards to `src/cli.js` with `--root packages`, so `cd packages && node
parallel_test.js ...` keeps working exactly as before.

## Troubleshooting

- **"Cache or git-aware features not available"** — the cache module failed to load;
  the runner falls back to running everything. Check the JSON files are valid.
- **A file keeps re-running although nothing changed** - run `--status`; a file that
  writes non-ignored files into its package changes its own fingerprint. Add
  those paths to the package `.gitignore`. `--reset` clears everything.
- **Worker noise on the terminal** — worker stdout/stderr are captured per file and
  only shown on failure or via the watchdog/`i` key.
- **Wrong worker count on a small CI runner** — set `CPU=4` explicitly, or lower
  `MIN_WORKER_COUNT`.
