# node-opcua-alias-name-common

Shared types, the OPC 10000-4 `Like` matcher and `VersionTime` helpers for OPC UA
**AliasNames** (OPC 10000-17).

These packages let a Server publish **its own** AliasNames and let a Client resolve
them. They do **not** aggregate AliasNames collected from other Servers: Annex B
(aggregating Server) and Annex C (GDS) of OPC 10000-17, and the Annex D PubSub change
notification, are out of scope. Anything that requires knowing about more than one
Server is not implemented here.

This package holds the framework-agnostic pieces used by both
`node-opcua-alias-name-server` and `node-opcua-alias-name-client`. It deliberately
depends on nothing heavier than `node-opcua-nodeid`.

see http://node-opcua.github.io/

## Installation

```bash
npm install node-opcua-alias-name-common
```

## What's in the box

### The `Like` matcher (OPC 10000-4, Table 120)

`FindAlias` takes an `AliasNameSearchPattern`, which is a `Like` pattern. The five
constructs are `%`, `_`, `\`, `[...]` and `[^...]`.

```ts
import { like, isValidLikePattern, LikePattern, InvalidLikePatternError } from "node-opcua-alias-name-common";

like("TI101", "TI%");          // true
like("would", "_ould");        // true
like("abc4", "abc[13-68]");    // true
like("xyzd", "xyz[^dgh]");     // false
like("5%",   "5[%]");          // true  - the list operand makes % literal
like("100%", "100\\%");        // true  - so does the escape character
```

Everything that is not one of the five constructs is matched **literally**, including
every regular expression metacharacter. This is the bug in implementations that build a
`RegExp` by substituting `%` and `_` and leaving the rest alone:

```ts
like("axb", "a.b");            // false - '.' is a full stop, not "any character"
```

The whole subject must match; the pattern is anchored at both ends.

**Compile once and reuse when testing many subjects.** `like()` re-parses on every
call, so a `like()` in a loop parses the pattern per record — and if the record set is
empty, a malformed pattern is never reported at all:

```ts
const pattern = new LikePattern("TI%");
names.filter((n) => pattern.test(n));
```

#### Where Table 120 is silent: `\` inside a list

The table defines `\` and `[...]` separately and never says what `\` means *inside* a
list. This implementation **honours the escape there too**, because the table describes
the escape unconditionally as allowing "literal interpretation" and because otherwise a
literal `]` cannot be put in a list at all:

```ts
like("]", "[a\\]b]");   // true  - the list is {a, ], b}
like("]", "[\\]]");     // true  - not an "empty list" error
like("-", "[a\\-z]");   // true  - the list is {a, -, z}, not the range a..z
like("m", "[a-z]");     // true  - an unescaped '-' is still a range
```

This is a reading, not a requirement — other implementations may choose the opposite —
so it is stated and pinned by tests rather than left to chance.

An invalid pattern throws `InvalidLikePatternError`, carrying the pattern and the index
at which parsing failed, so a Method binding can return `Bad_InvalidArgument`
(OPC 10000-17 clause 6.3.2 Table 4) instead of guessing. Use `isValidLikePattern` to
check without catching.

#### Case sensitivity

OPC 10000-4 states, immediately above Table 120, that *"The Like operator is case
sensitive"*, so this is not a point the specification leaves open and `like` is case
sensitive by default.

What OPC 10000-17 does leave open is whether *AliasName comparison* is case sensitive:
clause 6.2 requires only that a Client ignore an AliasName's namespace when comparing.
`{ caseInsensitive: true }` is offered as an explicit opt-in for servers whose tag
conventions need it, and is a deliberate deviation from Part 4:

```ts
like("TI101", "ti%", { caseInsensitive: true }); // true
```

The option affects **comparison only, never parsing**: whether a pattern is well formed
is the same either way, so `isValidLikePattern` can never accept a pattern that
`new LikePattern(...)` then rejects. Ranges are matched as written rather than
case-folded — folding the endpoints of `[Z-a]` would give `[z-a]`, which matches nothing.

The matcher is exported because `Like` is not specific to AliasNames — `QueryApplications`
(OPC 10000-12) and event filters use the same operator.

#### Cost, and the pattern length limit

`AliasNameSearchPattern` is attacker-supplied: `FindAlias` is a remote Method a Server
will usually let an anonymous session call. Writing `P` for the pattern length, `E` for
the parsed element count (`E <= P`), `A` for the number of `%` left after consecutive
ones are collapsed (`A <= E/2`) and `T` for the subject length:

| Stage | Bound | Why |
|---|---|---|
| Parsing | `O(P)` time, terminates | the cursor strictly increases every iteration |
| Recursion depth | `T + 2`, **independent of `P`** | recursion happens only at `%`, and consecutive `%` collapse, so each nesting level costs at least one subject character |
| Matching | `O(E * T)` time, `O(A * T)` memory | the memo explores each `(element, offset)` pair at most once |
| Parse allocation | `O(P)` | one element object per construct |

Only that last row grows with attacker input, and the transport accepts a String up to
`BinaryStream.maxStringLength` (16 MB by default) — which would turn one call into roughly
a gigabyte of objects. So patterns longer than `DEFAULT_MAX_PATTERN_LENGTH` (**2048
characters**) are refused with `InvalidLikePatternError` before anything is allocated,
which a Method binding reports as `Bad_InvalidArgument`. Capping `P` bounds every other
row with it.

A real search pattern is a tag glob such as `TI1%`, so 2 KB is already far beyond
practical use. Raise it with `{ maxPatternLength }` only if you have a reason.

Without the memo, a pattern alternating `%` and `_` reaches the same `(element, offset)`
pairs by exponentially many routes and effectively never returns — a naive backtracker
hangs on `%_%_%_...`.

### `VersionTime` (OPC 10000-4 clause 7.43)

The `LastChange` Property of an `AliasNameCategoryType` is a `VersionTime`: a **UInt32
count of seconds since 2000-01-01T00:00:00Z**. It is *not* a `DateTime`, which is the
easiest thing to get wrong here.

```ts
import { toVersionTime, fromVersionTime, maxVersionTime } from "node-opcua-alias-name-common";

toVersionTime(new Date("2000-01-01T00:00:00Z")); // 0
fromVersionTime(86400);                          // 2000-01-02T00:00:00.000Z
```

Two consequences worth designing around:

- **Resolution is one second.** Two changes inside the same second are
  indistinguishable. A Client that sees a `LastChange` *equal* to its cached value should
  re-browse rather than assume nothing changed; only a value *older* than the cached one
  means "drop the cache" (clause 6.3.1).
- **It wraps in 2136** (`VERSION_TIME_WRAP_DATE`, 2136-02-07T06:28:16Z). There is nothing
  in the specification to do about this; it is documented, not handled. Instants before
  the epoch clamp to `0` rather than wrapping to a far-future value.

`maxVersionTime` is the rollup used by clause 6.3.1, where a nested category's
`LastChange` is the latest of all its descendants.

### `IAliasStore`

> **Experimental.** The shape of `IAliasStore` is expected to move before it is
> considered stable. It is exported so a Server can back its aliases with something
> other than the address space — a database, a configuration file, an existing tag
> dictionary — but treat it as provisional.

`AliasEntry` carries the string part of the alias name only, because clause 6.2 requires
the namespace to be ignored when comparing AliasNames. `serverUris` is parallel to
`referencedNodes` and holds `null` for a Node on the local Server (clause 7.3).

## License

MIT — see [LICENSE](./LICENSE).
