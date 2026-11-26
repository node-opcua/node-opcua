# check-experimental

The status of a feature used to be stated in four places that nothing linked: a doc comment, a
start-up warning, a table in a markdown file, and the release note. Any one of them could go stale
without the others.

This check gives the status one record and derives the rest from it.

| what | where |
| --- | --- |
| the record of which API is experimental or unstable | the `experimental` or `unstable` tag on the exported symbol |
| the list, and what each status means | `EXPERIMENTAL.md` |
| how a report about an experimental feature is handled | `SECURITY.md` |
| the signal to an operator | the start-up warning in the code |

A tag cannot move away from the symbol that it marks, so the tag is the record.

## The two kinds

| Tag | Is it on? | Does it warn? | Table |
| --- | --- | --- | --- |
| `@experimental` | no, you turn it on | yes, one for each process | Experimental features |
| `@unstable` | yes, when you use it | no | Unstable APIs |

Both are listed. Nothing is hidden from a reader: an exported type whose shape will move is an
Unstable API, and it goes in the second table rather than out of sight.

## What it checks

Agreement:

- every tagged symbol has a row in the table of its kind;
- every row of a table names a symbol that carries that kind's tag;
- an `@experimental` symbol is named by a start-up warning, which is a quoted string that carries
  the word `experimental`. An `@unstable` symbol needs none.

That a reader can act on it:

- the row says **how to turn it on**, with an identifier in backticks;
- the doc block points at `EXPERIMENTAL.md`, so an editor hover says where to read;
- the start-up warning names `EXPERIMENTAL.md`, so an operator who sees it in a log knows where to
  go.

The second group is the useful half. A name that appears in three places still leaves a reader
asking how to turn the thing on and where to read about it.

It compares names and pointers. The prose of a row stays hand written.

## Usage

```bash
pnpm run check:experimental          # fail when the three disagree
pnpm run check:experimental:list     # print the features and their source location
pnpm run check:experimental:fix      # add a row the table does not have
```

`check:experimental` runs in `lint:ci`.

`--fix` only adds. It does not delete a row, because a row with no matching tag is more often a tag
that somebody forgot than a feature that went away, and the prose of a row is hand written. It does not
change source either: a missing start-up warning is code, so a human writes it. After a fix, write the
prose of the new row.

## Adding a kind

`KINDS` in `src/rule.js` maps a tag to its table heading and to whether it needs a start-up warning.
Add an entry there, add the heading and the table to `EXPERIMENTAL.md`, and the rest follows.

## Tests

```bash
node tools/check-experimental/test/test_rule.js
```
