# RFC: NodeSet-NDJSON — a line-oriented interchange form for OPC UA NodeSet2 documents

| | |
|---|---|
| **Status** | Draft for discussion — proposed to the OPC Foundation |
| **Version** | 3 (`schema: 3`) |
| **Authors** | Sterfive SAS — the node-opcua project |
| **Reference implementation** | `node-opcua-address-space`, `api/loader/nodeset_image_codec.ts` |
| **Date** | 2026-09-06 |

## Abstract

This document specifies **NodeSet-NDJSON**, a serialization of an OPC UA `UANodeSet`
document as [Newline-Delimited JSON](https://github.com/ndjson/ndjson-spec): one JSON
value per line, a header line, then one line per node, then a trailer line.

It is defined to be *equipotent* with the NodeSet2 XML schema
(`Opc.Ua.NodeSet2.xsd`): every NodeSet2 document has a NodeSet-NDJSON form that carries
the same information model, and every NodeSet-NDJSON document can be written back as
NodeSet2 XML with no loss. It is not a new information model, a new profile, or a
replacement for NodeSet2 XML. It is the same document in a form that a machine can read
an order of magnitude faster and store an order of magnitude smaller.

Over the 33 published nodesets shipped by node-opcua, the NodeSet-NDJSON form is
**668 647 bytes gzipped against 961 258 bytes for the same documents as gzipped XML —
30 % smaller, a factor of 1.44** (Appendix A). Uncompressed it is 40 % of the XML, and it
parses about three times faster, which makes a whole address space load about one and a
half times faster: parsing is not what dominates a load (Appendix C).

Those are useful numbers rather than dramatic ones, and they are deliberately quoted
against gzipped XML: comparing a compressed form against an uncompressed one would show a
factor of 22.7 and would mean nothing, since anyone shipping 15 MB of XML can gzip it.
**The strongest argument for this format is not its size but its canonicality** (§9):
NodeSet2 XML has no byte-level identity, and this does.

## 1. Status of this document

This is a draft submitted for discussion. It describes a format that is implemented,
shipped and exercised against the whole published nodeset catalogue, and whose
equivalence with NodeSet2 XML is checked mechanically on every release (§9). It is
offered as a starting point for a normative OPC Foundation specification, not as one.

## 2. Motivation

A NodeSet2 document is written once by a companion-specification working group and read
on every start of every server, client and tool that uses it. The published `Opc.Ua`
nodeset alone is 4.1 MB of XML holding 5 476 nodes; a modest server loads that plus DI,
Machinery and one or two companion specifications before it answers its first request.

XML is a good format for the writing: it is reviewable, diffable, schema-checked, and it
carries the comments and the structure a standards process needs. It is a poor format for
the reading:

- **Size.** The published catalogue is 15.2 MB. Embedded and browser deployments ship it,
  cache it and download it; every one of them pays for markup that says the same thing
  five thousand times.
- **Parse cost.** A conforming XML parser must handle namespaces, entities, mixed content,
  CDATA, DTD subsets and processing instructions before the first node is seen. A JSON
  parser is a `JSON.parse` per line, and every runtime has one in native code.
- **Streaming.** A NodeSet2 document is a single element with 5 000 children; a reader
  that wants one node at a time must run a SAX pass and maintain its own state machine.
  In NDJSON, the unit of the format is the unit of the model: a node is a line.
- **Ambiguity of the wire form.** Two NodeSet2 files may express the same model with
  different attribute order, entity spellings, alias definitions, indentation and node
  order. Nothing in the XML schema says which spelling is canonical, so no two tools agree
  on a byte-level identity for a nodeset.

NodeSet-NDJSON addresses all four without changing the information model. The design
constraint throughout was: **anything the XML can say, this must say; anything this can
say, the XML must be able to say.**

## 3. Terminology

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED,
MAY and OPTIONAL are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

- **Document** — one NodeSet-NDJSON file: one header, zero or more node lines, one trailer.
- **Writer** — a program that produces a document.
- **Reader** — a program that consumes one.
- **Local namespace index** — an index into *this document's own* namespace table, never
  into the namespace array of the address space that is loading it (§5.1).
- **Default** — the value a reader assigns to an absent key (§7).

## 4. File form

### 4.1 Encoding and framing

- A document MUST be UTF-8. A writer MUST NOT emit a byte-order mark; a reader MUST reject
  one, since it would make the first line invalid JSON.
- Lines are separated by LF (`U+000A`). A writer MUST NOT emit CR LF; a reader MAY accept
  and strip a trailing CR for robustness.
- Each line MUST be a complete JSON object, on one line: a writer MUST NOT emit a literal
  newline inside a line, including inside a string (they are escaped as `\n`).
- A document SHOULD end with a trailing LF after the trailer.
- Empty lines MUST be ignored by a reader and MUST NOT be produced by a writer.

Because every line stands alone, a reader can process a document of any size in constant
memory, and a corrupt or truncated document is detected at the line where it fails rather
than at the end.

### 4.2 Compression, media type and extension

A document MAY be stored and transmitted gzip-compressed
([RFC 1952](https://www.rfc-editor.org/rfc/rfc1952)). Because a gzip stream begins with the
two bytes `1f 8b`, and a NodeSet2 XML document with `<`, and an uncompressed NodeSet-NDJSON
document with `{`, the three forms are told apart by their first byte with no filename and
no metadata. Implementations SHOULD use that test rather than trusting an extension.

| Form | Extension | Media type |
|---|---|---|
| uncompressed | `.ndjson` | `application/vnd.opcfoundation.nodeset+ndjson` |
| gzip | `.ndjson.gz` | `application/vnd.opcfoundation.nodeset+ndjson`, `Content-Encoding: gzip` |

The compression level is a writer's choice and does not affect a reader: every gzip stream
inflates the same whatever level wrote it. Writers SHOULD use a high level, since a
document is written once and read many times. (The reference implementation moved from the
platform default to level 9 for a 4 % size reduction and no reader change at all.)

### 4.3 Document structure

```
line 1        the header record          {"kind":"header", ...}
lines 2..n-1  one node record per node   {"nodeClass":..., "nodeId":..., ...}
line n        the trailer record         {"kind":"trailer", ...}
```

- The header MUST be the first line. A reader MUST reject a document whose first line is
  not a header.
- Node records MUST follow the header and precede the trailer.
- The trailer MUST be the last line.
- Node records carry no `kind` key; a reader distinguishes them by the absence of `kind`.
- **Document order is not significant.** A reader MUST NOT require a node to appear before
  another, and MUST NOT depend on the order for anything but its own progress reporting. A
  writer SHOULD preserve the order of the source document, as an aid to diffing.

## 5. The header record

```json
{"kind":"header","schema":3,"addressSpaceVersion":"2.181.1",
 "createdAt":"2026-09-06T17:51:21.556Z",
 "namespaceUris":["http://opcfoundation.org/UA/DI/"],
 "models":[{"modelUri":"http://opcfoundation.org/UA/DI/","version":"1.05.0",
            "publicationDate":"2025-11-15T00:00:00.000Z",
            "requiredModels":[{"modelUri":"http://opcfoundation.org/UA/","version":"1.05.04",
                               "publicationDate":"2025-05-01T00:00:00.000Z"}]}],
 "aliases":{"Boolean":1,"HasComponent":47},
 "sourceLength":1030177}
```

| Key | Type | Presence | Meaning |
|---|---|---|---|
| `kind` | `"header"` | REQUIRED | |
| `schema` | integer | REQUIRED | the version of this specification the document is written to (§10) |
| `namespaceUris` | array of string | REQUIRED | the `<NamespaceUris>` of the source, in order; index 0 of the local table is always `http://opcfoundation.org/UA/` and is NOT listed here |
| `models` | array of model | REQUIRED | the `<Models>` of the source |
| `aliases` | object | REQUIRED | the `<Aliases>` of the source: alias name to encoded NodeId (§6.1) |
| `addressSpaceVersion` | string | OPTIONAL | what wrote the document; informative only, and a reader MUST NOT reject a document for it |
| `createdAt` | ISO-8601 string | OPTIONAL | when it was written; informative only |
| `sourceLength` | integer | OPTIONAL | the byte length of the document this was derived from, where there was one (§8.3) |

A model is `{modelUri, version, publicationDate, requiredModels[], symbolicName?, accessRestrictions?}`,
where `publicationDate` is an ISO-8601 string or `null`, and each required model is
`{modelUri, version, publicationDate}`.

`aliases` is carried for round-tripping only: **no record refers to an alias by name.**
Every NodeId in a document is written out in full (§6.1), so a reader never has to resolve
an alias to understand a node, and a writer never has to invent one. The table exists so
that a document written back as NodeSet2 XML can restore the `<Aliases>` section the source
declared.

### 5.1 Namespace indices are local

Every `NodeId` and `QualifiedName` in a document carries an index into **this document's own
namespace table**: 0 is `http://opcfoundation.org/UA/`, and 1..n are `namespaceUris[0..n-1]`
in order. They are never indices into the namespace array of the address space that is
loading the document.

This is a deliberate and load-bearing property. It means a document is self-contained and
its bytes do not depend on what else is loaded, so the same document can be shipped, cached
by content hash, and loaded into address spaces whose namespace arrays differ. The consumer
owns the translation from local indices to its own.

## 6. Encoding of the primitive types

JSON has no date, no binary, no 64-bit integer and no NodeId. Each has exactly one written
form here. A writer MUST use it; a reader MUST accept it and no other.

### 6.1 NodeId

| Case | Form | Example |
|---|---|---|
| numeric, namespace 0 | the number alone | `2258` |
| numeric, other namespace | `[namespaceIndex, value]` | `[1, 6033]` |
| any other identifier type | `[namespaceIndex, kind, value]` | `[1, "s", "MyNode"]` |

`kind` is `"i"` (numeric), `"s"` (string), `"g"` (GUID) or `"b"` (opaque). A GUID is its
canonical string form; an opaque identifier is base64. The one-element form is not merely a
size optimisation: the overwhelming majority of ids in a nodeset are numeric in namespace 0,
and giving them the shortest possible spelling is what keeps a line readable.

An **ExpandedNodeId** appearing as a value is
`{"id": <NodeId>, "namespaceUri": <string|null>, "serverIndex": <integer>}`.

A NodeId key whose value is *absent* means "null / not applicable" (§7).

### 6.2 QualifiedName

`[namespaceIndex, name]`, e.g. `[0, "EngineeringUnits"]`. `name` MUST be a string; an
absent name is `""`.

### 6.3 LocalizedText

`{"locale": <string>, "text": <string>}`, with each key omitted when it is absent in the
source. An empty LocalizedText is therefore `{}`; where a LocalizedText is optional, `{}`
and an absent key mean the same thing and a writer MUST omit the key.

### 6.4 Numbers

- `Int64` and `UInt64` are `[high, low]`, two 32-bit halves, because JSON numbers cannot
  carry 64 bits exactly.
- `Float` and `Double` are JSON numbers, except that the three values JSON has no literal
  for are written as the strings `"NaN"`, `"Infinity"` and `"-Infinity"`. A reader MUST
  accept both a number and one of those three strings wherever a float is expected.
- `StatusCode` is the numeric code.

### 6.5 DateTime

An ISO-8601 string, e.g. `"2025-11-15T00:00:00.000Z"`. Where sub-millisecond precision is
carried, `{"iso": <string>, "picoseconds": <integer>}` instead. A reader MUST accept both.

### 6.6 ByteString, Guid, String, XmlElement

- `ByteString`: base64.
- `Guid`, `String`, `XmlElement`: the string itself.

### 6.7 ExtensionObject

Four extension object types occur so often in nodesets, and matter so much to a loader,
that they are given a decoded form:

```json
{"$class":"Argument","name":"Handle","dataType":7,"description":{"text":"the handle"}}
{"$class":"EUInformation","namespaceUri":"http://...","unitId":4408652,"displayName":{"text":"°C"}}
{"$class":"Range","low":0,"high":100}
{"$class":"EnumValueType","value":[0,3],"displayName":{"text":"Off"}}
```

Every other extension object is carried as the XML fragment the source held, with the
NodeId of its `Default XML` encoding:

```json
{"$xml":[[1,15005],"<MyStruct><A>1</A></MyStruct>"]}
```

This is the one place the format admits XML, and it does so on purpose. A structure value
in a nodeset can only be decoded once the DataType that describes it is known, and a
DataType may be defined in the very document being read. Carrying the fragment verbatim
lets a reader defer the decode to the point where it is possible, exactly as an XML reader
must, and guarantees that a value the reader cannot understand is still preserved byte for
byte on the way out. **A reader MUST NOT reject a document because of an `$xml` fragment it
cannot decode**, unless it is asked for the value it holds.

### 6.8 Variant

```json
{"dataType": <DataType>, "arrayType": <VariantArrayType>, "dimensions": [2,2], "value": <encoded>}
```

- `dataType` is the numeric `DataType` enumeration value.
- `arrayType` is `0` scalar, `1` array, `2` matrix. It MUST be omitted for a scalar.
- `dimensions` MUST be present for a matrix and MUST be omitted otherwise.
- `value` is one encoded element for a scalar, an array of encoded elements for an array or
  a matrix (a matrix is written flat, with `dimensions` giving its shape), or `null`.

`DataValue` and `DiagnosticInfo` MUST NOT appear as a value in a document: nothing in a
NodeSet2 document can produce one, and a writer that meets one MUST fail rather than write
something a reader would have to guess at.

## 7. Node records, and the defaults

A node record is a JSON object with no `kind` key.

```json
{"nodeClass":2,"nodeId":[1,6033],"browseName":[1,"ParameterSet"],
 "references":[[1,40,68,0],[0,47,[1,15001]]],"dataType":12,"accessLevel":"3",
 "value":{"dataType":12,"value":"hello"}}
```

| Key | Type | Meaning |
|---|---|---|
| `nodeClass` | integer | the `NodeClass` enumeration value; REQUIRED |
| `nodeId` | NodeId | REQUIRED |
| `browseName` | QualifiedName | REQUIRED |
| `references` | array of reference | REQUIRED, MAY be empty (§7.2) |
| `displayName` | string | see §7.1 |
| `description` | string | |
| `symbolicName`, `inverseName` | string | |
| `releaseStatus` | `"Draft"` \| `"Deprecated"` | absent means `Released` |
| `accessRestrictions`, `accessLevel`, `userAccessLevel` | string | as declared in the source, uninterpreted |
| `hasNoPermissions` | boolean | |
| `rolePermissions` | array of `{roleId, permissions}` | |
| `isAbstract`, `symmetric`, `containsNoLoops`, `historizing` | boolean | |
| `eventNotifier`, `valueRank`, `minimumSamplingInterval` | integer | |
| `arrayDimensions` | array of integer, or `null` | |
| `parentNodeId`, `dataType`, `methodDeclarationId` | NodeId | |
| `value` | Variant (§6.8) | |
| `definition` | `{name?, isUnion?, fields[]}` | for a DataType (§7.3) |

A key that does not apply to a node class MUST be absent. A reader MUST ignore a key it
does not know: that is what lets a later version of this specification add one (§10).

### 7.1 Defaults

**A key whose value is the value a reader would assume anyway MUST be omitted.** This is
normative in both directions: a writer MUST omit it, and a reader MUST behave exactly as if
a document that states it and a document that omits it were the same document.

| Key | Default | |
|---|---|---|
| `displayName` | the node's own `browseName` name | |
| `valueRank` | `-1` | *ValueRank_Scalar* |
| `arrayDimensions` | `null` | |
| `minimumSamplingInterval` | `0` | |
| `historizing` | `false` | |
| `isAbstract` | `false` | |
| `symmetric` | `false` | |
| `containsNoLoops` | `false` | |
| `hasNoPermissions` | `false` | |
| `eventNotifier` | `0` | |
| `parentNodeId` | `null` | |
| `dataType` | `null` | |
| `methodDeclarationId` | `null` | |
| `value.arrayType` | `0` | *scalar* |
| `definition.fields[].valueRank` | `-1` | |
| `definition.fields[].allowSubTypes` | `false` | |
| `definition.fields[].dataType` | `24` | *BaseDataType* |
| `Argument.valueRank` | `-1` | |
| `Argument.arrayDimensions` | `[]` | an explicit `null` is a different value and is written |
| any optional LocalizedText | `{}` | |

These are not an invention of this format: with one exception they are the XSD default
attribute values of `Opc.Ua.NodeSet2.xsd`, which is to say they are the values an XML
reader already assigns to an absent attribute. Writing them out is redundant in the XML
too; the XML simply has no incentive to leave them out, and this format does.

The exception is `displayName`, whose default is not a constant but the node's own browse
name. It is called out because it is by far the most valuable of the rules: **on the 33
published nodesets, 19 237 of 19 859 nodes — 96.9 % — have a DisplayName that is exactly
their BrowseName.** It is also the only default a reader must materialise rather than
merely assume, since a consumer reads `displayName` directly.

A note on why the other rules earn less than they appear to. Removing `"minimumSamplingInterval":0`
deletes 383 KB from the uncompressed text of the catalogue and 8 KB from the gzipped bytes:
DEFLATE already codes a string repeated verbatim 13 676 times in a couple of bits. The whole
default table removes 26 % of the raw text and 11 % of the compressed bytes, and 7.6 of
those 11 points are `displayName` alone, because a browse name repeated is entropy and a
constant repeated is not. The table is in this specification for **canonicality** more than
for size: with it, two writers given the same model produce the same bytes.

### 7.2 References

A reference is `[isForward, referenceType, target]`:

```json
[1, 40, 68]        forward HasTypeDefinition to i=68
[0, 47, [1,6033]]  inverse HasComponent from ns=1;i=6033
[1, 40, 68, 0]     the same, with the hint below
```

`isForward` is `1` or `0`. `referenceType` and `target` are NodeIds (§6.1).

A fourth element, the integer `0`, is an OPTIONAL **hint**: it says that the target's own
record, *in this same document*, does not declare the inverse of this reference. A NodeSet2
document declares most references from both ends, and a loader must add a back reference
only for the few it does not. A writer that has seen the whole document can decide this once
and let every reader skip the check; a streaming writer that has not seen the whole document
MUST omit the hint, and a reader that finds it omitted MUST fall back to checking for itself
at the end of the load.

The hint is therefore **not information about the model**. Two documents that differ only in
their hints describe the same model, and a conformance test MUST NOT compare them. It is
stated here because it is on the wire and a reader must know what it means.

### 7.3 DataType definitions

```json
"definition":{"name":"MyStruct","isUnion":false,
              "fields":[{"name":"A","dataType":6,"description":{"text":"..."}}]}
"definition":{"name":"LocationIndicationType","isOptionSet":true,
              "fields":[{"name":"Visual","value":0},{"name":"Audible","value":1}]}
```

| Key | Meaning |
|---|---|
| `name` | the `Name` of the `<Definition>` |
| `isUnion` | the structure is a union: exactly one field is present |
| `isOptionSet` | the DataType is a bit mask: each field's `value` is a **bit position**, not an enumeration value |
| `fields` | the `<Field>` elements, in document order |

A field is `{name, dataType?, valueRank?, arrayDimensions?, isOptional?, allowSubTypes?, maxStringLength?, description?, displayName?, value?, symbolicName?}`,
with the defaults of §7.1 applied.

`isOptionSet` is carried because nothing else in the document distinguishes an OptionSet from an
ordinary enumeration: both are a DataType subtyped from an integer with a `<Definition>` of named
values. A reader that drops the flag produces a DataType that is wrong in a way no later step can
detect. An implementation whose address space models no OptionSet must still carry the flag and the
fields through, or the document cannot be written back out as the document it was.

## 8. The trailer record

```json
{"kind":"trailer","nodes":5476,"sourceDigest":"9c1d...e7"}
```

| Key | Type | Presence | Meaning |
|---|---|---|---|
| `kind` | `"trailer"` | REQUIRED | |
| `nodes` | integer | REQUIRED | the number of node records in the document |
| `sourceDigest` | string | OPTIONAL | see §8.3 |

### 8.1 Why a trailer at all

The trailer is what makes truncation detectable. A JSON document that is cut in half is
invalid JSON and any parser will say so; an NDJSON document that is cut in half is a
perfectly valid, shorter NDJSON document. Without a trailer, a nodeset truncated by a full
disk, a killed process or a half-written cache entry loads silently as a nodeset missing
half its nodes — which is very much worse than failing.

A reader MUST reject a document whose last line is not a trailer, and MUST reject one whose
`nodes` count does not match the number of node records it read.

### 8.2 Why the count and not a hash of the content

A hash of the node lines would catch more, but it would also make the format's identity
depend on the exact bytes of every line, and so freeze every future writer into reproducing
them. The count catches the failure mode that actually happens — truncation — at no cost to
a streaming writer, which knows the count only at the end and knows a content hash only by
buffering the whole document.

### 8.3 `sourceDigest` and derived documents

Where a document was derived from another representation of the same nodeset — typically the
NodeSet2 XML file it was compiled from — `sourceDigest` MAY carry a digest of that source's
bytes, and the header's `sourceLength` its length.

This lets an implementation treat a NodeSet-NDJSON file as a **cache** of an XML file: it
recomputes the digest of the XML, compares, and uses the NDJSON only if they agree, falling
back to parsing the XML otherwise. That is how the reference implementation ships a
precompiled `.ndjson.gz` next to every `.xml` in its catalogue and stays correct when
someone edits the XML.

The digest algorithm is not fixed by this specification, because the value is only ever
compared with one produced by the same implementation. An implementation that publishes
documents for others to validate SHOULD use SHA-256, hex-encoded. A reader that does not
know how a digest was computed MUST ignore it rather than reject the document.

## 9. Equivalence with NodeSet2 XML

The claim this format makes is that it is equipotent with NodeSet2 XML. That claim is
falsifiable, and the reference implementation ships the tool that tries to falsify it:

```
npx opcua-nodeset-equivalence <file.xml>...
```

The round trip it runs is the one that matters to somebody handing an implementation a nodeset
they did not write:

```
  <third party>/NodeSet2.xml  ->  NodeSet-NDJSON (A)  ->  address space
                                                              |
                    NodeSet-NDJSON (B)  <-  NodeSet2.xml written back out

                                  A == B
```

`A` is what the third party's document says; `B` is what the implementation's own document says
after the model has been all the way round. If the two agree, nothing was lost anywhere in the
loop — and NodeSet-NDJSON is the place to compare, because it is the only one of the four forms
with a canonical spelling (§7.1).

`==` is not byte equality, and could not be: two documents are free to order their namespace
tables and their node lines differently. `A` and `B` are compared after every identifier has been
resolved through *its own document's* namespace table into `<namespace uri>;i=<n>`, which is the
only spelling of an id that two documents can be held to. The comparison is then exact — same
namespaces, same set of nodes, same set of references, same value for every attribute of every
node.

Eight checks per document:

1. **records** — XML → records → NDJSON → records. The two record streams must agree field by
   field, once the defaults of §7.1 are applied to both. This is the check that a key a writer
   leaves out is a key a reader puts back.
2. **lines** — those records re-encoded must reproduce the very bytes of the NDJSON. The encoding
   is canonical, so a writer and a reader cannot drift apart silently.
3. **address space** — the address space built from the XML and the one built from the NDJSON must
   have the same digest: same nodes, same references, same values.
4. **xml** — the NodeSet2 XML written back out from each of those two address spaces must be the
   same bytes.
5. **A==B nodes** — `A` against `B`: same namespaces, same set of nodes, same set of references.
6. **A==B attrs** — `A` against `B` again, this time every attribute of every node.
7. **fixpoint** — a second pass over the exporter's own XML, which reaches constructs a
   hand-written file may not, must again say the same thing either way.
8. **xml-idempotent** — information rather than a verdict: whether the XML pipeline alone is
   idempotent.

Checks 1 to 4 isolate the format: they say the NDJSON reproduces the document exactly. Checks 5
and 6 then measure the whole loop, so a difference that shows up only there is the *XML writer*
of the implementation under test dropping something, rather than the format losing it — which is
why the tool prints the attribution alongside the difference instead of leaving the reader to
guess.

Three things are reported apart from the verdict, because each is a difference of spelling and
not of model, and each is provably harmless once ids are fully qualified:

- **the order of the namespace table** — which namespaces a document draws on is model; the order
  it happens to list them in is a local choice, exactly as document order is (§4.3);
- **`ParentNodeId`** — derivable from the aggregating reference, and a node reachable from two
  parents has more than one correct answer, so two documents may name different parents and
  describe the same model;
- **the §7.2 inverse-declaration hint**, for the reason given there.

The tool deliberately does **not** claim that the regenerated XML is byte-identical to the
file on disk, and no honest tool could: a NodeSet2 document carries comments, attribute
order, entity spellings, indentation, alias choices and node order that the information
model does not define. Two files may say exactly the same thing and differ in bytes. Check 4
compares the two documents at the first point where a canonical spelling exists — the
exporter's own — and check 5 shows that spelling is a fixpoint.

Turning that around gives the strongest statement the format can support, and the one this
RFC makes:

> **NodeSet-NDJSON is a canonical form for NodeSet2.** Two NodeSet2 documents describe the
> same information model if and only if they have the same NodeSet-NDJSON form, modulo the
> §7.2 hint and document order. Nothing is lost in either direction; only the freedom the
> XML syntax leaves is.

This is worth having on its own, quite apart from size and speed. It gives the Foundation a
byte-level identity for a nodeset — something to hash, sign, cache, diff and compare across
implementations — which NodeSet2 XML by itself cannot provide.

## 10. Versioning

The header's `schema` is an integer, incremented whenever the meaning of the existing keys
changes. A reader MUST reject a document whose `schema` it does not implement. It MUST NOT
attempt a partial read: a nodeset half-understood is worse than a nodeset not read, since
the failure surfaces later as a missing type rather than as an error at load.

Adding a new OPTIONAL key does **not** require a new `schema`, because §7 requires readers
to ignore unknown keys. Adding a new default, changing an existing default, or changing the
form of an existing key does.

Where documents are cached, the `schema` SHOULD be part of the cache key, so that a version
bump invalidates every cached document rather than requiring them to be found and deleted.

A bump is also the only way to invalidate stored documents when a *producer* becomes more faithful
— when a reader learns to read something it used to drop. Every document written before is still
valid under its schema and still parses; it is simply less faithful than the file it came from, and
neither its `sourceDigest` nor its `sourceLength` can reveal that, because the source did not
change. Schema 4 was bumped for exactly that reason.

Version history:

| `schema` | Change |
|---|---|
| 1 | initial |
| 2 | the §7.2 inverse-declaration hint |
| 3 | the default table of §7.1 |
| 4 | `definition.isOptionSet` and `definition.isUnion`, which the reader had been dropping; DateTime values, which it had not been reading at all |

## 11. Security considerations

A NodeSet-NDJSON document is a description of an information model and carries no
executable content. The considerations are those of any parsed input:

- A reader MUST bound the memory it commits to a single line, since a line is
  attacker-controlled in length. Reading a document line by line rather than whole is the
  natural defence and costs nothing.
- The `$xml` fragments of §6.7 are XML and MUST be parsed with external entity resolution
  and DTD processing disabled, as any NodeSet2 XML reader must.
- `sourceDigest` is an integrity check against accident, not against an adversary: it is
  carried in the document it protects. An implementation that needs authenticity MUST sign
  the document as a whole by some means outside this specification.
- A reader MUST NOT trust the trailer's `nodes` count as an allocation size before it has
  read that many records.

## 12. Relationship to other work

- **NodeSet2 XML** (`Opc.Ua.NodeSet2.xsd`) — the normative form. This specification is
  defined by reference to it and adds nothing to the information model.
- **OPC UA JSON encoding** (Part 6) — a wire encoding for *values and messages*, not for
  documents. It does not describe nodes, references or a nodeset, and NodeSet-NDJSON does
  not attempt to be a superset of it. Where the two describe the same thing they agree in
  substance and differ in spelling: Part 6 optimises for a general JSON consumer, this
  format for a nodeset that is 5 000 lines long. A future revision of this document could
  align §6 on Part 6's spellings if the Foundation preferred one JSON dialect over two; the
  cost would be roughly a doubling of the compressed size, and it is a trade the Foundation
  should make rather than an implementation.
- **UA Binary** — smaller still, and unreadable. A nodeset is a document that people review
  and diff, and a text format that a human can `grep` has value that a binary one does not.
  NDJSON keeps that: one node per line means `grep` finds a node.

## 13. Acknowledgements

The format grew out of the node-opcua loader, and its shape owes a great deal to what the
NodeSet2 XML reader had to do first.

---

## Appendix A — Measurements

The 33 nodesets published with node-opcua 2.181, 19 859 nodes in total.

Both forms compressed the same way, gzip level 9, so the comparison is like for like.

| | XML | XML gzip | NDJSON | NDJSON gzip |
|---|---|---|---|---|
| total | 15 209 385 | 961 258 | 6 115 205 | **668 647** |
| vs raw XML | 100 % | 6.3 % | 40.2 % | 4.4 % |
| vs gzipped XML | — | 100 % | — | **69.6 %** |

| Nodeset | XML gzip | NDJSON gzip | |
|---|---|---|---|
| `Opc.Ua.NodeSet2` | 261 455 | 180 578 | 0.69× |
| `Opc.Ua.Ijt.Base.NodeSet2` | 68 637 | 45 902 | 0.67× |
| `Opc.Ua.Woodworking.NodeSet2` | 57 263 | 43 342 | 0.76× |
| `Opc.Ua.Scales.NodeSet2` | 57 338 | 39 004 | 0.68× |
| `Opc.Ua.CNC.NodeSet` | 37 786 | 27 005 | 0.71× |
| `Opc.Ua.MachineVision.NodeSet2` | 37 955 | 25 544 | 0.67× |
| `Opc.Ua.PADIM.NodeSet2` | 29 332 | 18 274 | 0.62× |
| **all 33** | **961 258** | **668 647** | **0.70×** |

The honest reading: a consistent 30 % against the fair baseline, never better than 0.62×
on any single document. Worth having, not worth reorganising a specification for on its
own. Uncompressed — which is what a parser and a browser cache actually work on — the
margin is wider, 40.2 % of the XML.

Contribution of the §7.1 default table, measured over the whole catalogue by applying each
rule alone to the schema-2 documents:

| Rule | raw text | gzipped |
|---|---|---|
| `displayName` = browse name | −7.41 % | **−7.62 %** |
| `minimumSamplingInterval: 0` | −4.65 % | −1.02 % |
| `historizing: false` | −3.29 % | −0.73 % |
| `arrayDimensions: null` | −3.15 % | −0.66 % |
| `valueRank: -1` | −2.02 % | −0.50 % |
| extension object defaults | −1.70 % | −0.39 % |
| definition field defaults | −0.96 % | −0.32 % |
| `isAbstract: false` | −1.09 % | −0.23 % |
| `eventNotifier: 0` | −0.93 % | −0.22 % |
| null NodeId keys | −0.29 % | −0.14 % |
| **all** | **−26.2 %** | **−11.3 %** |

## Appendix C — Loading performance in node-opcua

Measured on the reference implementation, node-opcua 2.181 on Node.js 22.22, Windows 11,
loading each nodeset with its full dependency chain and the sibling-image cache disabled so
that each form is read from disk on every run.

**A whole address space, in a fresh process** — one load per process, JIT warm-up included,
best of three processes. This is what a server start pays.

| Loaded | Files | Nodes | XML | NDJSON | |
|---|---|---|---|---|---|
| the standard nodeset alone | 1 | 5 476 | 399 ms | 237 ms | ×1.7 |
| standard + DI | 2 | 5 923 | 416 ms | 280 ms | ×1.5 |
| standard + DI + Machinery | 4 | 6 225 | 425 ms | 291 ms | ×1.5 |
| + IA + MachineTool | 7 | 7 132 | 511 ms | 351 ms | ×1.5 |
| + Woodworking + Eumabois | 7 | 8 359 | 506 ms | 365 ms | ×1.4 |

**The same, warm** — best of five loads in one process, so the JIT has settled: 154 → 76 ms
for the standard nodeset, 240 → 132 ms for the Woodworking chain, ×1.7 to ×2.1 throughout.

**The parse phase alone** — source bytes to the record stream, no address space built:

| Document | Records | XML | NDJSON | |
|---|---|---|---|---|
| `Opc.Ua.NodeSet2` | 5 477 | 71 ms | 22 ms | ×3.2 |
| `Opc.Ua.Woodworking.NodeSet2` | 1 817 | 20 ms | 9 ms | ×2.3 |
| `Opc.Ua.Scales.NodeSet2` | 1 349 | 18 ms | 6 ms | ×3.2 |
| `Opc.Ua.Di.NodeSet2` | 448 | 6 ms | 2 ms | ×3.8 |

Read those three tables together and they say something worth stating plainly, because it
bears on what this format is for.

**Parsing is roughly three times faster, and that buys about one and a half times on a whole
load, because parsing is not what dominates a load.** Building the address space is — creating
nodes, resolving and installing references, binding extension object values, running the
post-load passes — and that work is identical whichever form the records came from. On the
standard nodeset the parse is 71 ms of a 399 ms load: even an instantaneous parser could not
take more than a fifth off.

So the case for NodeSet-NDJSON does not rest on load time. It rests on **size**, where the
factor is 22.7 and not 1.5, and on **canonicality** (§9), which is not a performance property
at all. The load-time gain is real, consistent, and secondary; an implementation choosing this
format to make its server start faster is choosing it for the smallest of its three benefits.

A note for implementers, since it was worth two of the milliseconds above: gzip inflation is
about a third of the NDJSON parse phase. Inflating a whole image once with the platform's
native zlib, rather than streaming it, is measurably cheaper on a document of this size, and
it moves the work off the main thread where the runtime supports it.

## Appendix B — A complete small document

```json
{"kind":"header","schema":3,"addressSpaceVersion":"2.181.1","createdAt":"2026-09-06T17:51:21.556Z","namespaceUris":["http://acme.example/UA/"],"models":[{"modelUri":"http://acme.example/UA/","version":"1.0.0","publicationDate":"2026-01-01T00:00:00.000Z","requiredModels":[{"modelUri":"http://opcfoundation.org/UA/","version":"1.05.04","publicationDate":"2025-05-01T00:00:00.000Z"}]}],"aliases":{"Double":11,"HasComponent":47,"HasTypeDefinition":40,"HasSubtype":45}}
{"nodeClass":8,"nodeId":[1,1000],"browseName":[1,"PumpType"],"references":[[0,45,58,0]],"description":"a pump"}
{"nodeClass":2,"nodeId":[1,1001],"browseName":[1,"Pressure"],"references":[[0,47,[1,1000],0],[1,40,63,0]],"parentNodeId":[1,1000],"dataType":11,"accessLevel":"3","value":{"dataType":11,"value":1.5}}
{"kind":"trailer","nodes":2,"sourceDigest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
```

Read that against the §7.1 table and the record is complete: `PumpType` is not abstract, has
no event notifier, and displays as `PumpType`; `Pressure` is a scalar with no array
dimensions, a sampling interval of 0, no historizing, and displays as `Pressure`. Fourteen
keys that a NodeSet2 XML file would have spelled out are simply not there, and nothing about
the model is in doubt.
