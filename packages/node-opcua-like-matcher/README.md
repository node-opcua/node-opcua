# node-opcua-like-matcher

The OPC 10000-4 `Like` FilterOperator — clause 7.4.4, Table 120 ("Wildcard characters").

A dependency-free string matcher. It has a package of its own because `Like` is a Part 4
primitive with several unrelated consumers, and none of them should have to depend on
another's package to get it:

- `AliasNameSearchPattern` on `FindAlias` / `FindAliasVerbose` (OPC 10000-17)
- the `applicationName` / `applicationUri` / `productUri` filters of `QueryApplications`
  (OPC 10000-12)
- Part 4 event filter ContentFilters

see http://node-opcua.github.io/

## Installation

```bash
npm install node-opcua-like-matcher
```

## Usage

```ts
import { like, isValidLikePattern, LikePattern, InvalidLikePatternError } from "node-opcua-like-matcher";

like("TI101", "TI%");          // true   - % is any run of characters
like("would", "_ould");        // true   - _ is exactly one character
like("abc4", "abc[13-68]");    // true   - a list, with ranges
like("xyzd", "xyz[^dgh]");     // false  - a negated list
like("5%",   "5[%]");          // true   - the list operand makes % literal
like("100%", "100\\%");        // true   - so does the escape character
```

The whole subject must match; the pattern is anchored at both ends. `main%` matches
anything starting with `main`, `%en%` anything containing `en`.

**Compile once and reuse when testing many subjects.** `like()` re-parses on every call,
so `like()` in a loop parses per record — and if the record set is empty, a malformed
pattern is never reported at all:

```ts
const pattern = new LikePattern("TI%");
records.filter((r) => pattern.test(r.name));
```

An invalid pattern throws `InvalidLikePatternError`, carrying the pattern and the index at
which parsing failed, so a Method binding can return `Bad_InvalidArgument` instead of
guessing. `isValidLikePattern` checks without throwing.

## Why not a RegExp

The intuitive implementation translates the pattern into `RegExp` source and calls
`.test()`. It is wrong twice over.

**Metacharacters leak.** Everything that is not one of the five wildcard constructs must
be matched literally, including every regex metacharacter:

```ts
like("axb", "a.b");   // false - '.' is a full stop, not "any character"
like("aaa", "a*");    // false - '*' is an asterisk
```

**It is a denial of service.** Each `%` becomes `.*`, and a backtracking engine explores
every way to split the subject across them. A nine-character pattern (`%%%%%%%%x`) against
a 40-character subject takes on the order of **15 seconds**. The same pattern here takes
about a millisecond, because runs of `%` are collapsed at parse time and failed
`(element, offset)` pairs are memoised.

Both are covered by tests, including timing guards that fail if anyone reintroduces a
`RegExp` translation.

## Cost and limits

Writing `P` for the pattern length, `E` for the parsed element count (`E <= P`), `A` for
the number of `%` left after consecutive ones collapse (`A <= E/2`) and `T` for the
subject length:

| Stage | Bound | Why |
|---|---|---|
| Parsing | `O(P)` time, terminates | the cursor strictly increases every iteration |
| Recursion depth | `T + 2`, **independent of `P`** | recursion happens only at `%`, and consecutive `%` collapse, so each nesting level costs at least one subject character |
| Matching | `O(E * T)` time, `O(A * T)` memory | the memo explores each `(element, offset)` pair at most once |
| Parse allocation | `O(P)` | one element object per construct |

Only the last row grows with attacker input, and the OPC UA transport accepts a String up
to `BinaryStream.maxStringLength` (16 MB by default) — which would turn one call into
roughly a gigabyte of objects. So patterns longer than `DEFAULT_MAX_PATTERN_LENGTH`
(**2048 characters**) are refused with `InvalidLikePatternError` before anything is
allocated. Capping `P` bounds every other row with it.

A real pattern is a glob a few characters long, so 2048 is already far beyond practical
use. Raise it with `{ maxPatternLength }` only if you have a reason.

## Case sensitivity

OPC 10000-4 states directly, immediately above Table 120, that *"The Like operator is case
sensitive"*, so this is not a point the specification leaves open and the matcher is case
sensitive by default.

Individual consumers may leave it open even though Part 4 does not — OPC 10000-17
clause 6.2 requires only that AliasName comparison ignore the namespace, and says nothing
about case. `{ caseInsensitive: true }` is an explicit opt-in for such a caller:

```ts
like("TI101", "ti%", { caseInsensitive: true }); // true
```

The option affects **comparison only, never parsing**: whether a pattern is well formed is
the same either way, so `isValidLikePattern` can never accept a pattern that
`new LikePattern(...)` then rejects. Ranges are matched as written rather than case-folded
— folding the endpoints of `[Z-a]` would give `[z-a]`, which matches nothing.

## Where Table 120 is silent: `\` inside a list

The table defines `\` and `[...]` separately and never says what `\` means *inside* a
list. This implementation **honours the escape there too**, because the table describes
the escape unconditionally as allowing "literal interpretation", and because otherwise a
literal `]` cannot be put in a list at all:

```ts
like("]", "[a\\]b]");   // true  - the list is {a, ], b}
like("]", "[\\]]");     // true  - not an "empty list" error
like("-", "[a\\-z]");   // true  - the list is {a, -, z}, not the range a..z
like("m", "[a-z]");     // true  - an unescaped '-' is still a range
```

This is a reading, not a requirement — other implementations may choose the opposite — so
it is stated here and pinned by tests rather than left to chance.

## License

MIT — see [LICENSE](./LICENSE).
