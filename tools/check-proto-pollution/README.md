# check-proto-pollution

Flags computed property-key writes (`obj[key] = value`) whose key could equal
`"__proto__"`, `"constructor"` or `"prototype"`. For `__proto__` that spelling does not
create a data property at all — it invokes `[[SetPrototypeOf]]`. If `key` derives from
data a remote peer controls (an OPC UA wire message, a parsed JSON/XML document, a
NodeSet/nodeset2 file, a StructureField/browse name, ...) a peer can reparent a class
instance (methods disappear — per-instance DoS) or, when the target is a plain object
used as a lookup map, pollute `Object.prototype` for the whole process.

This is the bug class fixed in GHSA-vjmq-2f58-rg3x:
`packages/node-opcua-schemas/source/dynamic_extension_object.ts`'s `setFieldValue()`
now writes through `Object.defineProperty` instead of `obj[name] = value`, and
`packages/node-opcua-client-dynamic-extension-object/source/convert_data_type_definition_to_structuretype_schema.ts`'s
`createField()` rejects the three dangerous names before they are ever used as a key.

## The fix

```ts
import { setOwnProperty } from "node-opcua-utils";

setOwnProperty(obj, key, value); // instead of obj[key] = value
```

It goes through `Object.defineProperty`, so the key always becomes an ordinary own
property. For a table that is also *read* with outside keys, start from
`Object.create(null)` or use a `Map`.

## What it checks

Walks every `.ts` file under `packages/*` and `packages_extra/*` (skipping
`test/tests/fixtures/examples/benchmark/dist/generated`) for `obj[key] = value` where
`key` is not a literal. It is **not** flagged when:

- `key` is a string/numeric/no-substitution-template literal.
- `key` is a `for (let i = 0; ...; i++)` loop counter (an array index, not a name).
- `obj` resolves to a binding declared `= Object.create(null)` — no prototype to hit.
- `key` is denylist-checked against the three dangerous names earlier in the same
  block, or in the `if` guarding the write — the shape of the reference fix.
- the write goes through `Object.defineProperty(...)` or a `Map`/`Set` — different
  syntax, not matched by this rule.

`Object.assign(target, source)` is flagged too unless `source` is a literal with plain
keys or `target` has no prototype: it copies with `[[Set]]`, so an own `"__proto__"` key
on the source (which is what `JSON.parse` produces) reaches the same setter.

Two details keep the exemptions honest. A guard counts only when the condition compares
*that identifier* with `"__proto__"` (or passes it to `has()`/`includes()` on something
that names `"__proto__"`); excluding only `"constructor"` closes nothing. And
`Object.create(null)` exempts the binding the write resolves to, not every variable in
the file that shares its name.

The baseline stores a **count** per `file::object[key]`. No line number, so it survives
edits above it; a count, so a second identical write in the same file is still new.

Writes are only half of it: a plain `{}` *read* with an untrusted key finds inherited
members (`map["constructor"]` is a function). This tool does not look for those; prefer
`Object.create(null)` or a `Map` for any table keyed by outside data.

This is a **syntactic** heuristic, not a taint analysis: it cannot tell an internal
enum key from a wire-decoded field name. That judgement is what a person does in
review (see the audit this tool grew out of). So every match is a real thing to look
at, not necessarily a real vulnerability — expect false positives, and use the
baseline to record the ones that were reviewed and found safe (or not worth the churn
to rewrite), rather than resolving them here.

## Usage

```bash
# report; exits 1 if there's a computed-key write not already in the baseline
node tools/check-proto-pollution.mjs
pnpm run check:protopollution

# scope to one package
node tools/check-proto-pollution.mjs --package node-opcua-server

# list every finding, ignoring the baseline
node tools/check-proto-pollution.mjs --all

# after reviewing new findings and deciding they're acceptable as-is, accept them
# into tools/proto-pollution-baseline.json (review the resulting diff like any other)
node tools/check-proto-pollution.mjs --update
pnpm run check:protopollution:update
```

Opt a single line out with a reason instead of touching the baseline:

```ts
obj[key] = value; // check-proto-pollution: ok - key is one of a fixed enum, see X
```

## Why a baseline instead of just fixing everything once

The first run over this repo turned up real, exploitable sinks (see the audit report
this tool was built alongside) as well as many writes that are safe only because of a
non-obvious invariant (a key that always carries a fixed prefix, a value that's never
an object so the `__proto__` setter no-ops, etc.) that the syntax can't see. Fixing
every flagged site up front — including the ones that are already safe — is exactly
the kind of scope creep this repo's guidelines ask reviewers to avoid. The baseline
lets the gate go live immediately (no *new* unreviewed sink can land) while the
existing, already-triaged findings get cleared file by file over time, each clearing
a small, reviewable diff instead of one huge one.
