# check-child-process

Shipped source does not run a child process through a shell.

```bash
node tools/check-child-process.mjs
node tools/check-child-process.mjs --package node-opcua-versions
```

## The rule

A finding is a call that resolves to an import of `node:child_process` (or `child_process`):

- `exec(...)` or `execSync(...)`. They always start a shell.
- `spawn`, `spawnSync`, `execFile`, `execFileSync` or `fork` with an object-literal argument
  that has a `shell` property whose value is not the literal `false`
  (`shell: true`, `shell: process.platform === "win32"`, `shell: someVar`).

Not a finding: no `shell` property, `shell: false`, options held in a variable, and any
`.exec(` that is not from `child_process` (`RegExp.prototype.exec`, a database handle).

Build an argument list and call `execFile` or `spawn` without a shell. If a shell is truly
needed, opt out on that line with a reason:

```ts
execSync(command, { cwd }); // check-child-process: ok - a fixed install command, no input
```

The marker may sit on the call line or on the `shell:` property line.

## Why

With a shell, any text that reaches the command is parsed as shell syntax. An argument list
has no such parsing.

## Implementation note

Parser-based, not regex-based: `.exec(` is mostly `RegExp.prototype.exec`.

## Scope

Shipped source only, taken from each package's `files` array via
`tools/shared/shipped_dirs.mjs`, plus `bin/`. Test trees are not scanned.
