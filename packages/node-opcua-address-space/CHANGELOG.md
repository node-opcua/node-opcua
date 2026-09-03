# Changelog

## [Unreleased]

### Added

#### A nodeset loads after the models it requires, whatever call loaded them

`generateAddressSpaceRaw` resolved each `RequiredModel` among the documents of the current call only, and failed
with `Cannot find namespace for http://opcfoundation.org/UA/` when a companion nodeset was given in a second call,
after `server.initialize()` had loaded `Opc.Ua.NodeSet2.xml`. A required model that the address space already
holds now counts as loaded when its version is at least the required one; a lower version is an error naming both
versions, and a model that neither the address space nor the call provides is still reported as missing.
`findOrder` takes the predicate as an optional second argument (`loadedModelSatisfies(addressSpace)`).

- The Node.js `generateAddressSpace` accepts `NodesetSource` values in its list next to file paths: a string is a
  path, anything else is a source (a gzip stream, an HTTP response, a string of XML through `{ name, source }`).
- `OPCUAServer` takes `nodesetSources?: NodesetSource[]`, loaded in the same call as `nodeset_filename` so a
  dependency may cross from one list to the other, and `nodesetLoaderOptions?: NodeSetLoaderOptions`
  (`yieldEveryBytes`, `imageStore`, `permissions`, `accessRestrictions`). The standard nodeset is still the
  default when `nodeset_filename` is absent; `nodeset_filename: []` leaves it to the sources.

### Changed

#### The default image path costs what the image path costs

The Node.js `generateAddressSpace` replays the image next to a NodeSet2 file after checking it against the XML.
That check used to read the XML whole and hash it on the main thread before anything else, and the image was
inflated through `DecompressionStream` and scanned line by line twice for its header and trailer.

- The XML's size is compared with the length the image header records first: a different length rejects the
  image with no read. On a match the XML is hashed with web crypto while the image inflates; the digest still
  decides, so an edit that keeps the byte count is caught as before. The file's timestamp is not a signal.
- An image given whole inflates through zlib in Node.js (`setImageInflater`, a third of the cost, off the main
  thread) and its header and trailer are read from its two ends whatever its size.
- Measured on the standard nodeset: sibling path 98 to 94 ms, six-file chain 134 to 117 ms, against 151 and
  194 ms from the XML; the explicit image path gains the same inflate and reader (93 to 89 ms, 125 to 110 ms).

#### Loader and exporter cleanup

One helper each for the nodeset dependency chain of the tests, the SHA-256 hex digest, the NodeId order of the
exporters, the gzip magic test and the "massively used reference type" predicate; one `nodesetImageProblem`
verdict shared by the image store path and the sibling path (the catalog check tool words its verdicts the same
way); the dead alias and encoding writers of the XML exporter removed; the image writer counts its lines and
the source reader keeps one prefix buffer. The XML export is byte-identical (golden test).

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
- Every load is fast with nothing to configure: the Node.js `generateAddressSpace` looks for `<name>.ndjson.gz` next
  to `<name>.xml` and replays it when its trailer digest is the SHA-256 of the XML bytes (one read and one hash, about
  12 ms for the standard nodeset); a missing, stale, truncated or unreadable image means the XML, silently, with a
  debug log line naming the path taken. `node-opcua-nodesets` ships such an image for every nodeset of its catalog.
  Nothing is written by this path; `imageStore: false` disables the sibling images too and streams the XML.
- `generateAddressSpace` with a path source and the sibling images on reads the file whole to hash it: the file
  streaming of the previous entry applies to `imageStore: false` and to `generateAddressSpaceRaw` sources.
- `bench_load_nodeset2.ts` gains an `image` variant. The standard nodeset loads 36% faster from its image than from
  the XML, a six-file companion chain 34% (best of 7, alternating).

#### A namespace exports to records and to an image, not only to XML

`namespace.toNodesetRecords()` yields the header record then one record per node, the same records the XML loader
yields for the equivalent NodeSet2 file, in the order `toNodeset2XML` writes its elements, with ids in the exported
file's own namespace table. `namespace.toNodesetImage()` and `namespaceToImage(namespace)` serialize them as a
precompiled image whose trailer digest is the SHA-256 of the node lines, so a re-import keys on content. Round trip
is the identity: a namespace loaded from a file, exported, loaded again from its records and exported once more
gives the same records, and the two address spaces digest the same; so does a namespace built in code, and
`toNodeset2XML` of the reloaded one is byte-identical.

- `opcua-nodeset-image export <file.xml>` exports the last file's namespace from the live address space.
- The loader reads `UAView` elements and views round-trip; a record applied to an address space is left untouched
  for the next consumer (the applier translates copies of the values it stores).
- `toNodeset2XML` is a consumer of the same walk: the records and the comment markers drive its order, each node's
  element is still rendered from the node, and `node.dumpXML(writer)` runs that walk from the node. Its output is
  byte-identical to before on every catalog namespace, pinned by a golden test.

#### Replaying an image inflates it once, and initial values are set as the variables are created

The default path inflated a catalog image three times (the sibling check, the header pre-pass and the replay) and
parsed it through a streaming reader with one turn of the microtask queue per record. An image given whole is now
inflated once, kept as lines for as long as its bytes live, and replayed through a synchronous iterator; the XML
path applies the records a chunk completes together, one turn per chunk. A variable whose data type is already in
the address space gets its initial value (or its default) when it is created instead of through a post-load task;
an extension object still waits for the data types to be extracted, and a refused value is logged and skipped as
the task did. Standard nodeset, best of 7 alternating: from its image 82 ms against 149 ms from the XML (45%, was
29%); the Node.js `generateAddressSpace` default path 98 ms against 144 ms (32%, was 13%); a six-file chain 42% and
33%.

#### Nodes are cheaper to build

The private record of a node is a symbol-keyed property instead of an entry in a module-wide `WeakMap`, so every
access to a node's references, cache or names is a property read rather than a hash lookup. A node's display
name and description are kept as given and turned into `LocalizedText` on first read; most of the 5 000 nodes of
the standard nodeset are never asked. The accessor name of a browse name is computed once per distinct name. The
loader no longer passes an empty value to the variables it creates, which made the constructor install a getter
and a setter (five closures) on every variable; an unbound variable reads and writes through the defaults, and
`clone()` still binds its copy. The initial `DataValue` of a variable is built from a null `Variant` rather than
from an options object. Standard nodeset from its image, ten loads on an idle machine: the record application
phase 72 ms to 37 ms, the whole load 144 ms to 87 ms; the XML path gains the same constructor time.

#### The end of a load propagates only the back references the document needs

A NodeSet2 file declares most references from both ends, so a back reference is only needed where
it does not. The image now records, per reference, whether the target's record declares the inverse
(a fourth element `0` on the references that need a back reference; record schema 2, the catalog
images are rebuilt and an image of another schema is skipped for its XML). Replaying an image, the
loader propagates those few references one by one and skips the sweep over every reference of every
node; the XML path, whose producer streams and cannot know, keeps the sweep. The sweep used to
resolve the target node and the type of every reference as a side effect; the lookups
(`findReferencesEx`, `findReferences`, `allReferences`) now resolve a target on first use, and the
exporters resolve the types they read. Standard nodeset from its image, CPU profile over 25 loads:
the back-reference phase 6.8 ms to 3.4 ms per load. The nodes a load settled are remembered in a
set that lives for the load only, not on the nodes.

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

#### Two type lookups corrected

- `addReference({ referenceType: "GeneratesEvent" })` kept the direction given only when the type's inverse name
  differed from its browse name; a reference type declaring its own name as inverse name (as some nodesets do)
  made the reference an inverse one. The browse name is looked up before the inverse name.
- The `isSubtypeOf` memo of a type now starts afresh when a `HasSubtype` reference moves anywhere: re-parenting
  a type used to leave its subtypes answering for the old parent.

#### The caches behind the load-time speedups are bounded, invalidated and shared correctly

A review of the memos and registries added with the loading performance work found eight places where
retained memory or a stale answer could outlive what it described. All are fixed, each with a regression test.

- A memoized `findReferencesEx` scan resolves a target created after the scan: `instantiate` and `deleteNode`
  read `ref.node` of a target that existed and found `null`.
- The scan memo and the child index follow a reference type that gains a `HasSubtype` link at runtime (a
  companion nodeset loaded on a live server, or the namespace API): a node with many references was blind to
  the new subtype while a small one saw it.
- `findReferencesEx` and `findReferences` return frozen arrays on a memo hit: a caller that changed one used to
  change what every later caller saw.
- The accessor-name registries hold the vocabulary of the loaded nodesets only: a server creating and deleting
  uniquely named nodes at runtime grew them by one entry per name, for ever.
- The inflated lines of a nodeset image are released once its replay is done: a `MemoryNodesetImageStore` at
  its 64 MiB cap could pin twelve times that in text.
- The `isSubtypeOf` memo is keyed by NodeId, not by the node asked about: a type created and deleted at runtime
  stayed reachable through the memos of the types it was compared with.
- An own child accessor (a runtime name) that later gets a shared getter answers through the child index and
  goes with its child; it used to keep returning the deleted node and hide its replacement.
- A nodeset loaded into an address space already in use no longer throws "reference exists already in
  _back_references" from the end-of-load sweep.

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
