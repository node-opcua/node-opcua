# node-opcua working notes

Written in Simplified Technical English (ASD-STE100). Keep it that way.

## Release notes and versioning

### What makes a minor

A patch corrects a defect. It changes nothing else that a consumer can see.

Use a minor version, and not a patch, for each of these changes:

- a default value changes (an option, an attribute, a certificate store policy);
- a status code changes;
- a path refuses a request that it accepted before;
- the code applies a permission or a restriction in a new place;
- an encoder or a writer gives different output;
- a public interface gets a new required member.

### Cadence

Cut a minor after two weeks. Cut a minor after ten patches. Use the first of these two limits.

A minor that stays open longer collects too much work for one release note. Short periods keep each
note small.

### Where a note lives

`RELEASE_NOTES.md` is in the root of the repository. It is the primary record. The newest section is at
the top. The file goes into the tarball, so a consumer can read it.

**Write the lines in the pull request that makes the change. Put them under the `Unreleased` heading at
the top of the file.** Create that heading if the last release consumed it. Do not wait for the release,
and do not write a version number: you do not know it yet.

The release stamps the version. `Unreleased` becomes `Release X.Y.Z`, so the heading is never a guess.
Two lerna lifecycle scripts do this. `preversion` refuses a release while `Unreleased` is missing or
empty. `version` renames the heading after lerna writes `lerna.json`. The stamped file then lands in
lerna's own release commit.

**In this repository the rename is still manual.** Rename the heading yourself when you cut the release,
until the hook is wired here.

Write one bullet for each change. Do not write prose for a patch.

A minor also gets a GitHub release with a full note. That note collects the sections of the patches
after the last minor.

Write a GitHub release for a minor only. Do not write a full note for a patch tag.

**A release with nothing to say is a defect.** If `Unreleased` is empty, either the change was not
user-visible, or somebody forgot the bullet. Find out which before you release.

### Section format

Write a heading with `##`:

```
## Unreleased

  - area: what the change does, in short active present tense. (#1234)
  - **behaviour change** what a consumer sees differently, and the new default.
  - **breaking** what stops to work, and what to do in its place.
  - **api** a public signature or a required member that changed.
```

Indent each bullet two spaces. Write a pull request as `(#1234)`. Write an issue as `issue #1234`. Do
not use an em-dash.

Do not write a title over a line of `=`. That older style needs the underline to stay the same length
as the title, which is one more thing to get wrong. The gate still reads it, because another file can
keep that style.

Sections before 2.187.32 keep a descriptive heading. They carry their release in square brackets at
the end, for example `## OPC UA JSON follows Part 6 1.04 and 1.05 [2.187.10]`. Leave those headings as
they are. Write a new section as `## Unreleased`.

### GitHub release note shape

Write the title as `vX.Y.Z: <caption>`. Use three or four words for the caption.

Then add these parts, in this order:

1. a banner for the one change that can surprise a user who upgrades. Give the step to migrate or to
   restore the old behaviour.
2. `## TL;DR`. Write two or three paragraphs. Put the features before the fixes. Use easy words.
3. `### Highlights`. Write one line for each item.
4. `### Behaviour changes to review before upgrading`.
5. sections by topic. Add the link to the pull request of each item.
6. `### New Contributors`. Use the form `* @handle made their first contribution in <pr url>`. Add a
   person only for a first contribution. To confirm this, run
   `gh pr list --author <handle> --state merged`.
7. `**Full Changelog**: <compare url>`.

Put the pull request links in the topic sections. Do not put a long list of numbers at the end.

### Security-relevant fixes: rules for public text

Public text includes a commit message, a pull request, an issue, a comment, `RELEASE_NOTES.md` and a
GitHub release. GitHub keeps the history of an edit. A line that you remove later stays public.

- Do not write an advisory identifier or a CVE identifier.
- Do not write "attacker", "exploit", "vulnerability", "bypass", "leak" or "fail-open".
- Write what the change does. Do not write why it is important for safety.
- Do not name a weakness that the release does not correct. Do not write "not covered", "still" or "a
  separate issue remains". Send this information to the private harness, or to the maintainer.
- Write the change as correctness work, or as consistency work.
- Add a credit for a reporter only if you promised a credit. Put the credit on the line of its item.
  Use the form `Thanks to <name> for the report. (#1234)`.
- Do not group the credits in one block. Do not add a security heading or a security section.

### Experimental features

The `experimental` TSDoc tag on the exported symbol is the record of which API is experimental. A tag
cannot move away from the symbol that it marks.

`EXPERIMENTAL.md` holds the list, and the conditions that put a feature in that state. Read it before
you write a note. Do not copy the list into this file. `SECURITY.md` holds one thing only: how we handle
a report about such a feature.

To see the list, run `pnpm run check:experimental:list`.

In a release note:

- Write `(experimental)` on each line about an experimental feature.
- If a note adds or changes such a feature, write that it is optional and that it is off by default.
  Write also that it makes a warning one time for each process when it starts.
- Do not write that an experimental feature is stable. Do not write that it is ready for production.

A feature becomes experimental, or stops to be experimental, in one release. Change these four together
in that release:

1. the tag on the exported symbol;
2. the table in `EXPERIMENTAL.md`;
3. the start-up warning in the code;
4. the release note, which says that the status changed.

If you add a new experimental feature, do the same four steps.

`pnpm run check:experimental` fails when the tags, the table and the start-up warnings disagree. It runs
in `lint:ci`, so you cannot forget a step. `pnpm run check:experimental:fix` adds a row that the table
does not have, and then you write the prose of that row. The fix does not delete a row, and it does not
change the code.

There are two kinds, and each one has its own tag and its own table in `EXPERIMENTAL.md`:

| Tag | Is it on? | Does it warn at start? |
| --- | --- | --- |
| `@experimental` | no, the user turns it on | yes, one time for each process |
| `@unstable` | yes, when the user uses it | no |

An `@unstable` API is an exported part whose shape can change. The user does not turn it on, and it
logs no warning. List it in the "Unstable APIs" table. Do not hide it: a reader must be able to learn
that its shape can move.

Each tag also makes the entry actionable, and the check enforces all three:

- the row says how to turn the part on, with an identifier in backticks;
- the doc block names `EXPERIMENTAL.md`, so an editor shows where to read;
- the start-up warning of an `@experimental` feature names `EXPERIMENTAL.md`, so an operator who reads
  a log knows where to go.

## Pull request message

Write these four parts, then stop:

- **Symptom.** What a reader saw. Give the error string that they would search for.
- **Cause.** One or two sentences.
- **Fix.** One or two sentences. Spell a new option or method exactly as the code spells it.
- **Test.** The command to run, and how to see it fail without the change.

Keep the whole message under about 250 words. Use a table only when it replaces prose.

Leave these out:

- text that repeats the diff;
- a list for each file;
- the story of how you found the defect;
- the solutions that you did not take;
- anything that the commits say.

### What to do with a caveat

**A caveat is a defect that you decided to keep. Fix it instead.**

Before you write one, find out which kind it is:

- a defect, or a gap: correct it in this pull request;
- a step that must come first: put it in the merge order, not in a caveat. If another pull request
  must merge first, name it in one line;
- behaviour that you intended: put it in the documentation of the tool;
- a limit that no code can remove: give it one line.

Three things always stay, because a reviewer assumes the opposite: what you took out, what you did
not verify, and how to see the test fail. Give each one a line.
