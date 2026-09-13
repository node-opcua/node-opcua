# check-c8-ignore

A coverage ignore hint that c8 does not read, so the line it was meant to exclude is counted
as uncovered.

## What c8 actually reads

Checked against a fixture in which each spelling guards a function that is never called, so an
honoured hint shows as an excluded line and an inert one shows as uncovered:

| spelling | honoured |
| --- | --- |
| `// c8 ignore next` | no |
| `// c8 ignore start` / `// c8 ignore stop` | no |
| `/* c8 ignore */` | no, there is no directive |
| `/* c8 ignore end */` | no, the terminator is spelled `stop` |
| `/* c8 ignore next */` | yes |
| `/* c8 ignore next 2 */` | yes, two lines |
| `/* c8 ignore start */` … `/* c8 ignore stop */` | yes, the region |
| `/* v8 ignore next */` | yes, the older name for the same hint |
| `/* c8 ignore next: why */`, `next -- why`, `next 1 : why` | yes, a trailing reason is fine |

So the hint has to be a **single-line block comment** carrying one of `next`, `next <n>`,
`start`, `stop`. Everything else is an ordinary comment.

This is quiet in both directions: nothing warns that a hint was not understood, and the only
symptom is a coverage figure lower than the code deserves. The repository had 235 line-comment
hints across 94 files, every one of them inert.

## Usage

```sh
node tools/check-c8-ignore.mjs                    # report, exit 1 on a violation
node tools/check-c8-ignore.mjs --fix              # rewrite them
node tools/check-c8-ignore.mjs --package node-opcua-client
node tools/check-c8-ignore.mjs --scope source     # shipped source only
node tools/check-c8-ignore.mjs --scope tests      # test trees only
```

`--fix` converts a line comment to the block form, and repairs `end` to `stop`. It will not
guess a directive for a hint that has none: that one is reported and left alone.

## Why it uses the scanner

`// c8 ignore` is distinctive enough for a regular expression, but a text substitution would
also rewrite it inside a string, inside a template literal, or in prose in a block comment -
and this repository documents the convention in its own tooling and in this file. The
TypeScript scanner tells a comment from a string, which is the same reason `check-cjs-globals`
and `check-dirname` parse rather than match.

A one-off exception takes `// check-c8-ignore: ok - why` on the same line.
