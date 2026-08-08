# AliasNames — End-to-End Scenarios (OPC 10000-17)

What each integration scenario proves, and why it cannot be proved anywhere else.

These packages let a Server publish **its own** AliasNames and let a Client resolve them.
Aggregating AliasNames collected from other Servers (Annexes B and C) and the Annex D
PubSub change notification are out of scope, so no scenario here involves a second Server.

## Why this package exists at all

The unit suites in `node-opcua-alias-name-server` and `node-opcua-alias-name-client` are
thorough — 134 and 29 tests — but every one of them drives `method.execute()` or a
`PseudoSession` **in process**. Four things are therefore invisible to them:

| Invisible in process | Why |
|---|---|
| **Encoding** | The ExtensionObject is handed to the caller by reference. It is never serialised, so a wrong field order or a mishandled null is undetectable. |
| **Chunking** | A result set is an array in memory. It is never framed, split, or reassembled. |
| **Permissions** | `SessionContext` is synthesised by the test. `getUserName()` returns whatever the test decided. |
| **Session lifetime** | There is no session to open, close, or run concurrently with another. |

Every scenario below exists to close one of those four. A scenario that a `PseudoSession`
could have proved belongs in the unit suite, not here.

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Exercised by a test in this package |
| ⬜ | Not yet — named so the gap is visible |

---

## 1. The ISA-5.1 bridge

**Background.** Part 17 is DNS for an address space. A Client knows the plant tag
`TI101`; the Server knows a Variable at `ns=2;i=1043` whose BrowseName is
`TemperatureIndicator`. Without AliasNames the Client must be configured with the NodeId,
and re-engineering the Server breaks it.

### 1.1 Resolve a tag to a Node ✅

> **Given** a Server publishing `TI101` over an explicitly modelled Variable
> **When** a Client calls `FindAlias("TI101")`
> **Then** it receives the `ExpandedNodeId` of that Variable

*Proves:* the round trip works over TCP at all. `test_alias_name_e2e.ts`

### 1.2 Read the value knowing only the tag ✅

> **Given** the same Server
> **When** a Client resolves `TI101` and then reads the returned NodeId
> **Then** it gets `21.5`

*Proves:* the resolved `ExpandedNodeId` is directly usable in a subsequent service call —
no NodeId appears anywhere in the test. This is the scenario the feature exists for.

### 1.3 Resolve a tag in a nested vendor subcategory ✅

> **Given** `LSH-201` held in `TagVariables/Unit200`, not directly under `TagVariables`
> **When** a Client calls `FindAlias("LSH-201")` on the `Aliases` root
> **Then** it is found

*Proves:* the recursive search of clause 6.3.1 works over the wire, not merely in the
store. A flat implementation passes every unit test that searches one category and fails
this.

### 1.4 Like pattern across the hierarchy ✅

> **When** a Client calls `FindAlias("%-201")`
> **Then** only `LSH-201` comes back

*Proves:* the OPC 10000-4 matcher is reached with the pattern intact after string
encoding.

---

## 2. Encoding

**Background.** `AliasNameVerboseDataType` had **no generated class at all** before this
work — it was declared nine times in the shipped NodeSet2.xml with nothing to encode it.
Encoding is therefore the single most likely place for this feature to break.

### 2.1 `AliasNameDataType` round trip ✅

> **When** a Client calls `FindAlias("%101")`
> **Then** both entries arrive with a well-formed name and referenced Nodes

*Proves:* the binary encoder and decoder agree on clause 7.2's field order.

### 2.2 `AliasNameVerboseDataType` round trip, with a null inside an array ✅

> **When** a Client calls `FindAliasVerbose("LSH-201")`
> **Then** `ServerUris` is `[null]`, the same length as `ReferencedNodes`, and
> `AliasNameCategoryId` names `Unit200`

*Proves:* clause 7.3's `ServerUris` — a `String[]` whose entries are legitimately null for
a local Node — survives encoding. A null inside an array is a classic encoder bug, and the
in-process test cannot see it because the array is never encoded.

### 2.3 Non-zero namespace index preserved ✅

> **Then** the returned AliasName's namespace index is not 0

*Proves:* the QualifiedName's namespace survives the wire. Namespace 0 is reserved for the
OPC Foundation and would be wrong; the earlier implementation reported it, and only an
assertion catches a regression.

---

## 3. Permissions under a real session

**Background.** OPC 10000-17 defines no security model — four `Bad_UserAccessDenied` rows,
no Security clause, no Roles, no `RolePermissions` on any Part 17 node. Every Server
supplies its own rule, so the hook has to work against a real identity.

The sample Server denies the `Unit200` category to `contractor` and allows it to
`engineer`.

### 3.1 An allowed user sees everything ✅

> **Given** a session authenticated as `engineer`
> **When** it calls `FindAlias("%")` on the root
> **Then** all three tags come back

### 3.2 A denied category is hidden, not refused ✅

> **Given** a session authenticated as `contractor`
> **When** it calls `FindAlias("%")` on the root
> **Then** it gets `Good` with `TI101` and `FIT-101`, and no sign that `LSH-201` exists

*Proves:* the omission of clause 6.3.2 — there is no status code for "exists but not for
you", so absence is the only answer that discloses nothing. An error, or a count that
changed, would confirm the category is there.

### 3.3 A direct call on a denied category is refused ✅

> **When** `contractor` calls `FindAlias` on `Unit200` itself
> **Then** `Bad_UserAccessDenied`

*Proves:* the other half of the rule. Silence here would be a lie rather than a
non-disclosure — there is nothing left to filter.

### 3.4 The gate is per session, not per Server ✅

> **When** two identities query the same running Server
> **Then** each sees its own view

*Proves:* the rule reads the calling session's identity, not Server-global state. In
process, `getUserName()` is whatever the test injected; here it comes from a real
`ActivateSession`.

---

## 4. A large result

**Background.** A real plant has thousands of tags. Three demo tags never leave one
message chunk.

### 4.1 2000 aliases arrive intact ✅

> **Given** a Server with 2000 aliases under a `Bulk` category
> **When** a Client calls `FindAlias("BULK-%")`
> **Then** exactly 2000 entries arrive

*Proves:* framing, chunking and reassembly. `test_large_result_chunking.ts`

### 4.2 Every entry is well formed after chunked transfer ✅

> **Then** every entry matches `BULK-\d{5}` and has exactly one referenced Node

*Proves:* no chunk boundary corrupted an ExtensionObject. A boundary falling inside one
damages the entries around it rather than the whole response, so a count alone would miss
it.

### 4.3 Order is stable across calls ✅

*Proves:* the default insertion-order comparator is genuinely deterministic, which is the
justification for it being the default (clause 6.3.2 leaves "best match first" to the
Server, and a single Server has no basis to prefer one of its own Nodes).

### 4.4 A large verbose result ✅

*Proves:* the same for the larger of the two encodings.

### 4.5 `maxResults` still bites on a large set ✅

> **Given** a Server capped at 10 with 100 aliases
> **Then** `Bad_ResponseTooLarge`, and a narrower pattern succeeds

*Proves:* clause 6.3.2 Table 4's "try new filter and repeat find" is actionable.

---

## 5. Session lifetime

### 5.1 A second session after the first closes ✅
### 5.2 Two concurrent sessions ✅
### 5.3 Cached Method NodeIds stay valid within a session ✅

*Proves:* `ClientAliasSet` caches Method NodeIds per instance, and those NodeIds belong to
the Server rather than the session, so nothing goes stale when sessions come and go.

---

## 6. Discovery

### 6.1 The `ALIAS` capability is advertised ✅

> **Given** a sample Server that never sets `capabilitiesForMDNS` itself
> **When** `installAliasNames` runs between `initialize()` and `start()`
> **Then** the Server's `capabilitiesForMDNS` contains `ALIAS`

*Proves:* OPC 10000-12 Annex D Table D.1 is honoured **automatically**. A Server that omits
the capability is never found by anything looking for alias-capable Servers, and **nothing
reports the failure** — so declaring it is part of installing the feature rather than
something each Server has to remember. The sample deliberately does not set it, so this
scenario exercises the automatic path.

Note the spelling: Part 17's prose writes it `Alias`, Part 12 Annex D is normative and
writes `ALIAS`, matched case-insensitively.

---

## 7. Browsing

### 7.1 The published hierarchy is browsable ✅

> **Then** `Aliases` shows `TagVariables` and `Topics`, and `TagVariables` shows `Unit200`

*Proves:* a Client that wants to display the tree rather than resolve one tag can.

---

## Known gaps

| Scenario | Status |
|---|---|
| `LastChange` updates when an alias is added | ⬜ NOA-7; the Property is inert in this release |
| `LastChange` survives a Server restart | ⬜ NOA-7; `persistencePath` throws rather than pretending |
| `AddAliasesToCategory` over the wire | ⬜ clause 6.3.4; the store stub returns `Bad_NotSupported` per entry |
| `DeleteAliasesFromCategory` over the wire | ⬜ clause 6.3.5 |
| A Node on another Server (non-zero `ServerIndex`) | ⬜ needs two Servers; out of scope by design. The client-side resolution step is unit-tested in `node-opcua-alias-name-client`. |
| UACTT run | ⬜ not yet executed against the sample Server |

## Running it by hand

```bash
npm run sample-server --workspace node-opcua-alias-name-test
```

Then point a Client — or UACTT — at the printed endpoint and call `FindAlias` on `Aliases`
(`i=23470`). `--bulk 2000` adds the large tag set; `--port` moves it.
