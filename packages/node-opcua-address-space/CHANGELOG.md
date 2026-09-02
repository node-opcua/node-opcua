# Changelog

## [Unreleased]

### Changed

#### Child properties (`server.serverStatus.currentTime`) are inherited accessors, no longer installed on every node

Loading a nodeset used to end with a sweep that turned every hierarchical child into an own accessor of its
parent: four reference scans per node, 12% of the load time of `Opc.Ua.NodeSet2.xml` and 7% of its heap.
A browse name seen while a nodeset loads now gets one getter, shared on the node prototype, that resolves the
child through the node's child index; `getComponentByName`, `getPropertyByName`, `getMethodByName` and
`getFolderElementByName` read that same index instead of scanning references. Names first created at runtime
through the namespace API keep the per-parent accessor they had.

- `Object.hasOwn(node, "enabledState")` is now false and `Object.keys(node)` no longer lists children;
  `"enabledState" in node` is true on every node and reads `undefined` where the child is absent.
- A child can no longer shadow an attribute, a method or a field: `object.eventNotifier` is the attribute even
  on a PubSub `PublishedEventsType` instance, `node.namespaceUri` is the namespace URI (the generated types
  already name the NamespaceMetadata child `$namespaceUri`), and a child named `Then` no longer makes its
  parent a thenable. Reach such children with `getChildByName`.
- A dotted child is one reached through a structural reference: a component, a property, a subtype or an
  organized node. A node that is only an event source or a notifier of its parent is not exposed, and removing
  the structural reference removes the child even when a `HasNotifier` reference to it remains.
- When two children share a name the first one wins, as before; removing it now reveals the second.
- `isFrugal = true` works end to end: it only suppresses the per-parent accessors of runtime names.
- New `addressSpace.registerChildAccessorNames(names)` gives runtime names a shared accessor too.

#### Reference lookups on the load path stop rescanning and reallocating

- `findReferencesEx` is memoized per reference type and direction on nodes holding more than eight references (a
  leaf variable holds three and scans them faster than a map would cost), dropped with the rest of the node cache on
  every reference added or removed and whenever a reference type is created (the callers iterate the result and
  never change it). Removing a back reference now clears the cache of the node that held it, which it never did.
- `checkHasSubtype` indexes reference types by NodeId value instead of building a string per reference per scan.
- A back reference is no longer allocated for a reference the NodeSet2 file declares from both ends.
- The loader translates each NodeId string of a file once, and a node under construction clears its caches once
  rather than once per reference.

#### Initial values take a shorter path

The value a nodeset declares for a variable, or the default of its data type, is set through an internal
`_setInitialDataValue`: the same compatibility checks as `setValueFromSource` (a wrong `<Value>` in a
third-party nodeset is still reported and skipped), without the clone of the previous value, the comparison
with it, the change event and the touch of the parents that a variable nobody has seen yet cannot need.

#### The child-accessor rule is available to the typed-interface generator

`childAccessorNamesShadowedBy(node)` (internal) lists the names under which a child of that node can never be
reached: the reserved names, the members of its class and its own fields. The generator of the
`node-opcua-nodeset-*` interfaces escapes exactly those, so the interfaces promise what the runtime exposes.

#### A node allocates what it uses

- References are indexed under a safe integer (direction, a per-address-space ordinal of the reference type,
  the target NodeId packed) instead of a string built from two `NodeId.toString()` calls; a string key remains for
  non-numeric identifiers and namespaces above 255. `ReferenceImpl.hash` still exists for callers that want it.
- The map of back references is shared and empty until the first back reference arrives (a nodeset declares most
  references from both ends, so most nodes never receive one), and the node cache is created on first use.

#### TranslateBrowsePath and browse filtering cost what they should

- A forward TranslateBrowsePath step naming its target through a hierarchical reference type is answered from the
  child index instead of a scan of every reference of the node with a deep comparison per child: one step on a
  folder of 5 000 children goes from about 5 ms to about 3 µs. Inverse steps and non-hierarchical reference types
  keep the scan, and the reference-type and subtype filter applies unchanged.
- Browse filtering by node class tests the mask bit instead of turning each class into its name and back.
- `isSubtypeOf` memoizes a node argument by identity, so a call with a node builds no string.
- The reference types every child lookup needs are resolved once per address space.

#### `generateAddressSpace` rejects when a post-load promoter throws

The promotion of loaded objects and variables (`promoteObjectsAndVariables`) was never awaited, so a failure
there surfaced as an unhandled rejection after `generateAddressSpace` had resolved.


#### Raising an event fills a layout computed once per event type

`raiseEvent` used to browse the event type and each of its supertypes on every call to find out which fields the
event carries: 20 fields cost 225us per event, 90% of it in that discovery. The layout of an event type (its
fields, their browse paths, the names under which the caller gives their values) is now built on first use and
kept, and rebuilt when the type, one of its supertypes or one of their children gains or loses a reference. The
same event now takes 75us, most of it the construction of the caller's Variants. The browse-path index that a
select clause resolves against is shared by every event of the type; the values stay per event.

#### A nodeset loads from a source, not only from a file

`generateAddressSpaceRaw` takes `NodesetSource` values next to the `uris + xmlLoader` form: the document as a
string or as UTF-8 bytes, a stream of chunks (a Node.js `Readable`, a web `ReadableStream`, an async generator),
or a function opening one, each optionally named for error messages. Chunks are parsed as they arrive; the
dependency pre-pass reads a stream only as far as its `<Models>` and `<NamespaceUris>` header and hands the chunks it
kept to the body parse, so a stream that cannot be reopened is read exactly once. Decompression stays the caller's:
wrap `zlib.createGunzip()` or a `DecompressionStream` around the source. The Node.js `generateAddressSpace` now reads
each file as a 256 KB stream instead of one string. A load fed in chunks costs the same as one fed the whole string.

- New option `yieldEveryBytes` (default 8 MiB): a nodeset arriving in chunks lets the event loop turn once that much
  text has been parsed, so a server keeps answering while a large model loads.
- A source that fails half-way rejects the load with the source named and the address space no longer marked as
  loading; it holds what was loaded before the failure and must be disposed.
- `NodeSetLoader.addNodeSetStream(chunks)` next to `addNodeSetAsync(xml)`.
- The loader is split in a record producer and a record consumer. The XML reader emits one `NodesetRecord` per
  node (ids in the file's own namespace table, aliases resolved, an undecodable extension object left as an
  `XmlExtensionObjectFragment` in the value) and `NodesetRecordApplier` turns the records into nodes, translating
  ids and applying the loader options; `NodeSetLoader.addRecords(producer)` loads from any producer. The address
  space built from every nodeset of the catalog is unchanged (`test/test_nodeset_catalog_digests.ts` pins it). One
  difference on purpose: a method's `ParentNodeId` is now translated to the address space's namespace table like
  every other id, where it used to be passed through as the file's string.

#### Precompiled nodeset images, and a store that makes the second load skip the XML

An image is the records of a NodeSet2 document as JSON Lines, gzip-compressed (`.ndjson.gz`): a header (schema,
writer version, namespace URIs, models, resolved aliases), one line per node, and a trailer with the node count and
the SHA-256 of the source bytes. Ids are indexes in the file's own namespace table (a bare number for a numeric id in namespace 0, a
tuple otherwise), so an image depends on nothing but its own file; every value type has one JSON rule (`nodeset_image_codec.ts`); the four extension objects the
XML reader decodes itself are typed JSON, every other one stays the XML fragment the loader decodes once the data
types are known. `NodesetImageWriter` is a record consumer and `imageNodesetRecords` a record producer, so an image
is written in the same pass as the XML parse and replayed exactly as the XML is applied.

- `nodesetToImage(source)` converts a file or source; it needs neither the file's dependencies nor an address space.
- Option `imageStore` (a `NodesetImageStore`, or `true`): a document given whole is hashed and its image replayed
  when the store has it, parsed and written otherwise; a stream is parsed and written, and replayed only when its
  named source carries an `imageKey`. The key is the record schema plus the digest, never the package version. An
  image that does not inflate, does not count, or was built from other bytes is discarded and rebuilt, with a debug
  log line. `true` selects `FileNodesetImageStore` in the Node.js `generateAddressSpace` (a per-user directory,
  `NODE_OPCUA_NODESET_IMAGE_DIR` or `~/.cache/node-opcua/nodeset-images`, atomic writes, oldest-first eviction,
  files writable by others ignored) and a process-wide memory store elsewhere.
- A source that holds an image is recognized by its first bytes and replayed, store or not; images and XML files mix
  in one call and are ordered by their dependencies together.
- `opcua-nodeset-image build | verify | info`, a bin of this package: convert files, prove an image loads what its
  XML loads, print an image's header and trailer.
- `bench_load_nodeset2.ts` gains an `image` variant. The standard nodeset loads 36% faster from its image than from
  the XML, a six-file companion chain 34% (best of 7, alternating).

### Security

#### Per-node `RolePermissions` and `AccessRestrictions` are no longer dropped when loading a NodeSet2 file

The loader had no reference to `RolePermissions` at all and read `AccessRestrictions` only on `<Model>`,
never per node, so a nodeset declaring a per-node access policy loaded fail-open: the policy simply
vanished. The exporter dropped the same two, so a load / dump round trip silently widened access.

- **Import** — the `AccessRestrictions` and `HasNoPermissions` attributes and the `<RolePermissions>`
  element are now read on every node class and installed through `setAccessRestrictions()` /
  `setRolePermissions()`. `HasNoPermissions="true"` becomes an empty permission list, which is distinct
  from an absent `<RolePermissions>`: the former grants nothing, the latter inherits the namespace default.
- **Export** — `namespace.toNodeset2XML()` emits `AccessRestrictions`, `HasNoPermissions` and a
  `<RolePermissions>` element, placed after `<References>` as `UANodeSet.xsd` requires.
- **Two switches, with different defaults** — the two halves of the policy answer different questions,
  so they are controlled separately:
    - `NodeSetLoaderOptions.permissions` (`<RolePermissions>`, `HasNoPermissions`) — _who_ may do _what_.
      A property of the information model, so it defaults to `"apply"`. Set `"ignore"` to restore the
      previous fail-open behaviour.
    - `NodeSetLoaderOptions.accessRestrictions` (the `AccessRestrictions` attribute) — how the
      SecureChannel must be secured before the node can be reached. A property of the _deployment_, which
      the loader cannot assume, so it is **opt-in** and defaults to `"ignore"`. Set `"apply"` once your
      endpoints require signing or encryption.

**Impact:** role-based permissions now take effect — `Opc.Ua.NodeSet2.xml` alone carries 854
`RolePermission` entries. Its 359 `AccessRestrictions` stay dormant unless you opt in: enforcing them
denies 199 variables under the Server Object alone (the RoleSet internals, `ServerConfiguration`, method
arguments) to any Session on an unsecured channel. That is the correct reading of the attribute and what
a hardened server wants, but it is a large change for deployments running with `MessageSecurityMode.None`.

#### The `Anonymous` Role is the baseline every Session stands on

`Opc.Ua.NodeSet2.xml` names five Roles across its `RolePermission` entries — `Anonymous`, `SecurityAdmin`,
`ConfigureAdmin` and the two `SecurityKeyServer` ones — and never `AuthenticatedUser`, `Observer`,
`Operator`, `Engineer` or `Supervisor`. Its 195 `Anonymous` entries are therefore the floor granted to
everyone, not a privilege of unauthenticated Sessions. Read literally they left an authenticated user
unable to browse the `RoleSet` or call `ChangePassword` on itself (OPC 10000-18 §5.2.8), with strictly
less access than an anonymous one.

Permission evaluation now adds the `Anonymous` Role to the Session's own. This can only widen a permission
set, and only to what an unauthenticated Session already has, so it grants nothing an attacker could not
obtain by not authenticating. `getCurrentUserRoles()` is unchanged: the identity a Session reports stays
truthful, only the permission evaluation gains the baseline.

#### Permissions that cannot be resolved for a Session can now fail closed

`SessionContext.getPermissions()` treated "no Role resolved" as "grant everything", which conflated a
context with no Session at all — `SessionContext.defaultContext`, a `PseudoSession`, both in-process
callers that node-opcua relies on being permissive — with a remote Session whose identity resolved to
nothing.

The two are now distinct. A context with no Session is always granted every permission, by design. A
Session that resolved to no Role, or a node whose namespace declares no `RolePermissions` at all, follows
the new `IServerBase.unresolvedPermissionPolicy`, which defaults to `"allow"` — unchanged behaviour — and
can be set to `"deny"` by products that drive access entirely from declared policy.

### Fixed

#### The `UserAccessLevel` attribute of a `UAVariable` is no longer lost by the NodeSet2 serialisation layer ([#1552](https://github.com/node-opcua/node-opcua/issues/1552))

Sibling of [#1550](https://github.com/node-opcua/node-opcua/issues/1550), in the same two files.
`UserAccessLevel` was dropped in both directions: the loader forced `userAccessLevel = accessLevel` with
the parsing commented out, and the exporter had no logic for the attribute at all.

- **Import** — an explicit `<UAVariable UserAccessLevel="1">` is now honoured. When the attribute is
  absent, `userAccessLevel` still falls back on `accessLevel` rather than on the XSD default of `1`:
  a nodeset that raises `AccessLevel` and stays silent on `UserAccessLevel` means "the user may do
  whatever the node allows", and taking the XSD default literally would make most nodesets read-only.
- **Export** — `UserAccessLevel` is emitted only when it restricts `AccessLevel`, and never on a
  `<UAVariableType>` element, which `UANodeSet.xsd` does not allow it on.

**Impact:** consumers that used to observe `userAccessLevel === accessLevel` on every variable loaded from
a NodeSet2 file will now see the restriction the file actually declares.

#### The `Historizing` attribute of a `UAVariable` is no longer lost by the NodeSet2 serialisation layer ([#1550](https://github.com/node-opcua/node-opcua/issues/1550))

`Historizing` is a first class attribute of `UAVariable` in `UANodeSet.xsd`, but it used to be dropped in
both directions: the exporter never wrote it, and the loader hardcoded `historizing: false`.

- **Export** — `namespace.toNodeset2XML()` now emits `Historizing="true"` on a `<UAVariable>` element whose
  variable has `historizing === true`. As for `AccessLevel` and `MinimumSamplingInterval`, the XSD default is
  not written: a variable with `historizing === false` produces no `Historizing` attribute. The attribute is
  never emitted on `<UAVariableType>` elements, which `UANodeSet.xsd` does not allow it on.
- **Import** — a `<UAVariable Historizing="true">` element now yields a `UAVariable` with
  `historizing === true`. A missing attribute still yields `false`, as per the XSD default.

**Impact:** consumers that used to observe a constant `historizing === false` on variables loaded from a
NodeSet2 file will now see `true` for the variables that the file actually declares as historized — for
instance the two `LocalCoordinate` variables of `Opc.Ua.AutoID.NodeSet2.xml`. This only restores the fidelity
of the attribute: no historian is installed and no historical data is collected as a result.
