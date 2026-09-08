# NodeSet-NDJSON: an internal load cache, and an implementation report on OPC 10000-6 Annex I

| | |
|---|---|
| **Status** | **Withdrawn as an interchange proposal.** Annex I is the normative JSON NodeSet. What is specified here is an internal cache format, frozen at `schema: 3`. |
| **Version** | 3 (`schema: 3`), frozen |
| **Authors** | Sterfive SAS, the node-opcua project |
| **Reference implementation** | `node-opcua-address-space`: `api/loader/nodeset_record.ts` (the record), `nodeset_image_codec.ts` (this encoding), `nodeset_xml_producer.ts` (NodeSet2 XML in), `nodeset_records_to_xml.ts` (NodeSet2 XML out) |
| **The normative JSON NodeSet** | `node-opcua-uanodeset-json`, implementing OPC 10000-6 Annex I |
| **Date** | 2026-09-08 |

## Abstract

This document does two things.

It **specifies NodeSet-NDJSON**, a serialization of an OPC UA `UANodeSet` as
[Newline-Delimited JSON](https://github.com/ndjson/ndjson-spec): one JSON value per line, a
header, one line per node, a trailer. node-opcua uses it as a load cache and ships it beside the
published nodesets. It is not offered to anyone as an interchange format, and §1 says why.

It also **reports what implementing OPC 10000-6 Annex I established**, since this is the second
independent implementation of that annex and the first outside the OPC Foundation's own tool.
§2.3 is a review of the annex, written from having read it by writing code against it rather than
from reading it.

The parts of this document with value beyond either format are §9: what equivalence between two
serializations of an information model actually means, why **a round trip cannot prove it**
(§9.3), and what a canonical form buys that neither NodeSet2 XML nor Annex I currently has
(§9.4).

## 1. Status of this document

An earlier revision proposed NodeSet-NDJSON to the OPC Foundation as an interchange format. That
proposal is withdrawn, and the reason is simply that it was made in ignorance:

**OPC 10000-6 draft 1.05.08 carries Annex I as normative**, and I.4 of it specifies a
line-delimited JSON serialization of a `UANodeSet`. There will be a specified JSON NodeSet, it
is not this one, and a second format competing with it would help nobody. Annex I is what
node-opcua reads and writes for exchange, through `node-opcua-uanodeset-json`.

Two things in the earlier revision were wrong in a way worth recording, because both came from
arguing about a document without having read it:

- It asserted that no Annex I existed. That was checked against the *published* 1.05, where it
  does not; the draft lives outside the specification repository. The available evidence was
  mistaken for all of it.
- It proposed replacing Annex I's `nsu=<uri>;` NodeIds with a namespace table, on a size
  argument. Annex I.1 states *"No namespace table: NodeIds and QualifiedNames embed the
  NamespaceUri directly"* as a deliberate decision. That was not a 2 % argument about gzip; it
  was a request to rewrite the annex.

**What NodeSet-NDJSON remains.** node-opcua loads faster from it than from XML (Appendix C), so
it stays as a private cache: written by the build, read by the loader, shipped beside the
catalogue. It is **frozen at `schema: 3`** and carries no cross-version guarantee to anyone
outside this repository. The freeze is also what makes every measurement in this document
reproducible; if the encoding moved, none of them could be checked again.

The specification below is therefore documentation of something that exists, not a proposal.

## 2. Annex I, and what implementing it established

### 2.1 What was implemented

`node-opcua-uanodeset-json` reads and writes all three serializations the annex defines:

| | Annex | form |
|---|---|---|
| `.jsonl` | I.4 | one JSON object per line, header first |
| `.json` | I.1 | one document, children nested in their parent's `ChildList` |
| `.uanodeset` | I.3 | a TAR.GZ of a manifest and numbered members |

Three checks were run, in increasing order of what they can establish:

1. **Digest equality.** The DI nodeset read from all three forms produces an address space whose
   digest equals the one built from its NodeSet2 XML, where the digest covers every node's id,
   browse name, class, reference count and, for variables, status code and value. Agreeing node
   counts would not have been that claim.
2. **Fixpoint.** `write(read(write(read(x))))` is byte-identical to `write(read(x))`, for the
   document form and for the archive down to the tar bytes.
3. **Cross-implementation.** The OPC Foundation's `UA-NodeSetTool` reads what node-opcua writes,
   and its `compare` reports the result identical to the original XML.

Only the third is an independent oracle, and §2.3 records what it caught that the first two
could not.

### 2.2 What conformance costs, measured

Same input through both implementations, gzip level 9, warm parse best of thirty, on the
published `Opc.Ua` nodeset (5 476 nodes):

| | Annex I JSONL | NodeSet-NDJSON |
|---|---|---|
| raw | 2 360 KB | 1 969 KB |
| gzipped | 207.3 KB | 184.1 KB |
| `JSON.parse` per node | 1.43 µs | 1.14 µs |

Adopting Annex I as the shipped exchange form therefore costs roughly **11 % more bytes and 26 %
more parse time** on that nodeset. That is the price of conformance and it is worth paying, but
it should be stated rather than glossed.

Decomposed like for like, the difference is not where a first reading suggests:

- **relationship encoding: Annex I is 37 % cheaper** (27.9 KB against 38.3 KB gzipped), because
  it turns `HasTypeDefinition` into a `TypeId` field, `HasModellingRule` into `ModellingRuleId`,
  and the parent-to-child forward edge into `ParentId`, so three of the most repetitive edges in
  a nodeset stop being edges;
- **everything else: NodeSet-NDJSON is 18 % cheaper** (150.3 KB against 184.3 KB), which is the
  default table of §7.1 doing its work.

An earlier revision of this document attributed most of the gap to reference encoding on the
strength of a decomposition that stripped `References` from one side while the other kept the
same information in `TypeId` and `ModellingRuleId`. The figures above compare the two halves
fairly.

### 2.3 Review comments on Annex I

Offered as observations from an implementation, not as proposals.

**A document does not say which schema version it was written against.** The annex names one
schema URL and the reference tool's README says the schema will change. A `$schema` field would
make a document self-identifying, and it is purely additive.

**There is no integrity or truncation detection.** A document that stops halfway is a document
with fewer nodes, and nothing says so. A trailer carrying node counts and a source digest is what
makes a derived cache safely replayable (§8 gives this format's reasoning, which transfers).

**I.3 leaves three things open.** The manifest field is spelled `IsChangeSet` in one place and
`ChangeSet` in another; the tar flavour is not pinned, so a reader has to accept both the
original V7 layout and ustar, and recognise an archive by its header checksum rather than by a
magic string; and "the shall any errors shall result in" appears to be a drafting slip.

**`BrowseName` has no index form**, so a QualifiedName always carries a full namespace URI. This
is noted as an observation rather than a proposal, since I.1 makes that choice deliberately and
for good reasons.

**`DesignToolOnly` is dropped, and that one is ours.** The DI nodeset states it nine times;
node-opcua's address space has no reference to it in any code path, so it is lost in every
format the SDK reads or writes. Neither the digest check nor the fixpoint could see it, because
a loss the reader and the writer share closes the loop invisibly. It was found by using another
implementation's `compare` as an oracle. This is the concrete instance of §9.3, and it is a
node-opcua defect rather than an Annex I one.

### 2.4 What was learned about this format

Measured on NodeSet-NDJSON, gzipped, the `Opc.Ua` nodeset, and all parked behind the freeze:

- **Dropping the parent-to-child forward edge saves 6.8 %** (184.1 to 171.7 KB), and is lossless:
  all 3 804 are reconstructible from the inverse, with no reference-type disagreements. It rides
  the existing inverse-declaration propagation of §7.2, so it needs no new mechanism. This is the
  one change worth making whenever the format unfreezes.
- **Hoisting `HasTypeDefinition` and `HasModellingRule` into scalar fields is worse**, by 0.3 %
  and 0.2 %. They are the most repetitive tuples in the file, gzip already handles them, and the
  replacement field name costs more than the tuple saved. Annex I gains from this only because it
  has no equivalent of §7.1.
- **Splitting `references` from `backReferences` is worse**, by 0.5 %: the key name costs more
  than the direction flag saves.

The first of these is a genuine improvement that was found by reading Annex I. The other two are
recorded so that nobody re-derives them from the same plausible reasoning.

## 3. Terminology

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED,
MAY and OPTIONAL are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

They bind implementations of this format, which today means node-opcua and anything reading
the images it ships. They are not addressed to a standards body: see §1.

- **Document**: one NodeSet-NDJSON file: one header, zero or more node lines, one trailer.
- **Writer**: a program that produces a document.
- **Reader**: a program that consumes one.
- **Local namespace index**: an index into *this document's own* namespace table, never
  into the namespace array of the address space that is loading it (§5.1).
- **Default**: the value a reader assigns to an absent key (§7).

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
([RFC 1952](https://www.rfc-editor.org/rfc/rfc1952)).

| Form | Extension | Media type |
|---|---|---|
| uncompressed | `.ndjson` | `application/vnd.sterfive.nodeset+ndjson` |
| gzip | `.ndjson.gz` | `application/vnd.sterfive.nodeset+ndjson`, `Content-Encoding: gzip` |

Neither media type is registered, and neither is in the `vnd.opcfoundation` tree: an earlier
revision put them there, which was not ours to do.

**The first byte does not identify this format**, and an earlier revision said it did. It claimed
gzip's `1f 8b`, XML's `<` and this format's `{` told the three apart with no filename and no
metadata. That was true of the formats it knew about and false as soon as there was another
JSON one: Annex I's `.jsonl` and `.json` both begin with `{` as well, and a gzipped anything
begins with `1f 8b`. The reference implementation held exactly that bug, claiming every gzip
stream as one of its own images.

What actually discriminates is the header line, after inflating: a document of this format has
`"kind":"header"` and an integer `schema`, an Annex I JSONL document has `Models` and no `kind`.
A reader SHOULD sniff on the parsed first line and MUST NOT decide on an extension or a first
byte. node-opcua does this through the `NodesetFormat` registry, which sniffs the container
first and the format second, on the inflated head.

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
| `extensions` | array of string | OPTIONAL | the `<Extension>` elements of the source's document-level `<Extensions>`, each as the XML it is |
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

- `Int64` and `UInt64` are a **decimal string**: `"-1"`, `"18446744073709551615"`. JSON numbers
  cannot carry 64 bits exactly, and a pair of 32-bit halves (the obvious alternative, and what
  the reference implementation holds in memory) cannot be read without knowing the signedness
  from somewhere else: as halves, `Int64 -1` and `UInt64 18446744073709551615` are the same two
  numbers. It would also give one value two spellings, since `Int64` min is `[2147483648, 0]` with
  unsigned halves and `[-2147483648, 0]` with signed ones, which no canonical form can allow.
  A writer MUST emit no leading zeros, `-` only for a negative value, and never `+`.
  This is also the spelling the OPC UA JSON encoding of Part 6 uses, so it is one divergence
  fewer (§12).
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
{"$class":"EnumValueType","value":"3","displayName":{"text":"Off"}}
```

Those four, and no others. **A writer MUST NOT emit a decoded form for any other extension
object type**; every other one MUST be carried as the XML fragment the source held, with the
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

The restriction is what makes the format cheap to convert *out of*. Because the only things a
value can hold are the four types above and opaque XML, **writing a document back as NodeSet2 XML
needs no DataType definitions at all**: not the document's own, not those of the namespaces it
depends on. A converter needs no information model, no address space and no catalogue: it is a
transcription between two spellings, and §9 measures it as one.

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
| `category` | array of string | the `<Category>` elements, in order; a node may declare several |
| `documentation` | string | the `<Documentation>` element: at most one |
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
published nodesets, 19 237 of 19 859 nodes (96.9 %) have a DisplayName that is exactly
their BrowseName.** It is also the only default a reader must materialise rather than
merely assume, since a consumer reads `displayName` directly.

A note on why the other rules earn less than they appear to. Removing `"minimumSamplingInterval":0`
deletes 383 KB from the uncompressed text of the catalogue and 8 KB from the gzipped bytes:
DEFLATE already codes a string repeated verbatim 13 676 times in a couple of bits. The whole
default table removes 26 % of the raw text and 11 % of the compressed bytes, and 7.6 of
those 11 points are `displayName` alone, because a browse name repeated is entropy and a
constant repeated is not. The table is in this specification for **canonicality** more than
for size: with it, two writers given the same model agree on the content of every line. Fixing
the order of the lines as well is what §9.4 adds, and the two together are what make a document
a byte-level identity for a nodeset.

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

A writer MUST NOT put any other value in the fourth position: values other than `0` are
reserved, and a reader that meets one MUST reject the document rather than guess at a meaning a
later revision may give it.

The hint is therefore **not information about the model**. Two documents that differ only in
their hints describe the same model, and a conformance test MUST NOT compare them. It is
stated here because it is on the wire and a reader must know what it means. A document in
canonical form omits it (§9.4).

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
half its nodes, which is very much worse than failing.

A reader MUST reject a document whose last line is not a trailer, and MUST reject one whose
`nodes` count does not match the number of node records it read.

### 8.2 Why the count and not a hash of the content

A hash of the node lines would catch more, but it would also make the format's identity
depend on the exact bytes of every line, and so freeze every future writer into reproducing
them. The count catches the failure mode that actually happens (truncation) at no cost to
a streaming writer, which knows the count only at the end and knows a content hash only by
buffering the whole document.

An implementation that wants a content hash after all can have one without this specification
providing it: the digest of a document in canonical form (§9.4) is exactly that, and it is
computed over bytes any conforming writer reproduces.

### 8.3 `sourceDigest` and derived documents

Where a document was derived from another representation of the same nodeset (typically the
NodeSet2 XML file it was compiled from), `sourceDigest` MAY carry a digest of that source's
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
falsifiable, and the reference implementation ships the tools that try to falsify it.

There are two different questions here, and they are worth keeping apart, because only the
first is about the format:

1. does the NodeSet-NDJSON form of a document carry the document? (§9.1)
2. does a given implementation lose anything when it loads one and writes it back? (§9.2)

### 9.1 The format: a round trip with no information model in it

A NodeSet-NDJSON document can be written back as NodeSet2 XML **directly**, from the records,
with no address space, no DataType definitions and no catalogue, for the reason given in §6.7.
That makes the tightest possible test available:

```
    NodeSet2.xml  ->  records  ->  NodeSet2.xml  ->  records
                        A                              B
                                A == B
```

Nothing in that loop knows what an information model is. If `A == B`, then every key a writer
left out is a key a reader put back, and the two spellings carry the same document.

Over the 33 published nodesets (**19 892 records, 19 859 nodes**), `A == B` holds exactly:
same namespaces, same nodes, same references, same value for every attribute of every node, with
no exceptions and nothing excluded. That is the claim this specification makes about itself.

Alongside it runs an **element census**: every element name is counted in the source document and
in the regenerated one, and the two counts must agree. It exists because of §9.3.

Neither check needs a model, so neither needs the tooling of §9.2. The conversion itself is one
command:

```
npx opcua-nodeset-image xml <file.ndjson.gz>     # a document back to NodeSet2 XML
npx opcua-nodeset-image diff <a> <b>             # two documents, record by record, either form
```

### 9.2 An implementation: the loop through an address space

The other round trip is the one that matters to somebody handing an implementation a nodeset they
did not write, and what it measures is *that implementation*:

```
  <third party>/NodeSet2.xml  ->  NodeSet-NDJSON (A)  ->  address space
                                                              |
                    NodeSet-NDJSON (B)  <-  NodeSet2.xml written back out

                                  A == B
```

`==` is not byte equality, and could not be: two documents are free to order their namespace
tables and their node lines differently. `A` and `B` are compared after every identifier has been
resolved through *its own document's* namespace table into `<namespace uri>;i=<n>`, which is the
only spelling of an id that two documents can be held to.

```
npx opcua-nodeset-live equivalence <file.xml>...
```

1. **records**: XML to records to NDJSON to records, field by field.
2. **lines**: those records re-encoded must reproduce the very bytes of the NDJSON.
3. **address space**: the address space built from the XML and the one built from the NDJSON
   must have the same digest.
4. **xml**: the NodeSet2 XML written back out from each of those two address spaces must be the
   same bytes.
5. **A==B nodes**: same namespaces, same set of nodes, same set of references.
6. **A==B attrs**: every attribute of every node.
7. **fixpoint**: a second pass over the exporter's own XML must again say the same thing.
8. **xml-idempotent**: information rather than a verdict, whether the XML pipeline alone is
   idempotent.

Checks 1 to 4 isolate the format; 5 and 6 measure the whole loop. A difference that shows up only
in 5 and 6 is the *implementation's XML writer* dropping something rather than the format losing
it, and the tool prints that attribution alongside the difference instead of leaving the reader to
guess.

A useful calibration of what the address space costs: of the 33 nodesets, the document written
directly from the records and the document written from a loaded address space load into a
**byte-identical address space for 31 of them**. Where they differ it is the address space that
lost something, and §9.1 says which side to believe.

Three things are reported apart from the verdict, because each is a difference of spelling and not
of model, and each is provably harmless once ids are fully qualified:

- **the order of the namespace table**: which namespaces a document draws on is model; the order
  it happens to list them in is a local choice, exactly as document order is (§4.3);
- **`ParentNodeId`**: derivable from the aggregating reference, and a node reachable from two
  parents has more than one correct answer;
- **the §7.2 inverse-declaration hint**, for the reason given there.

The tool deliberately does **not** claim that the regenerated XML is byte-identical to the file on
disk, and no honest tool could: a NodeSet2 document carries comments, attribute order, entity
spellings, indentation, alias choices and node order that the information model does not define.

### 9.3 What a round trip cannot prove

A round trip is a fixpoint test, and a fixpoint proves less than it appears to. **If a reader and
a writer are lossy in the same place, the loop closes and the loss is invisible.**

This is not hypothetical. Until the revision that produced this text, the reference implementation
dropped `<Category>`, `<Documentation>` and `<Extensions>`: 2415 Documentation and 2048 Category
elements across the published catalogue, including the Foundation's own cross-references into its
specification text. Every check in §9.2 passed throughout, because both sides dropped them
alike. No comparison of records could ever have found it.

What found it was counting elements in the source document. An implementation claiming conformance
SHOULD therefore run an element census as well as a round trip, and any future extension of this
specification SHOULD state which elements of `UANodeSet` it does not carry, rather than leaving
the question to a test that cannot ask it.

### 9.4 Canonical form

§4.3 leaves document order free, and §7.2's hint is not information about the model. A
document is therefore not *by itself* a byte-level identity for a nodeset: two conforming writers
given the same model may legitimately produce different bytes.

A document is in **canonical form** when, in addition to conforming to the rest of this
specification:

1. node records appear in ascending order of `nodeId`: by namespace index first, then by
   identifier type in the order numeric, string, GUID, opaque, then by identifier, numerically
   for a numeric identifier and by Unicode code point for the others;
2. within a node record, references appear in that same order of their target, ties broken by
   reference type and then by `isForward`, forward first;
3. the keys of every JSON object appear in the order this specification lists them;
4. `aliases` keys appear in ascending Unicode code point order;
5. the §7.2 hint is omitted.

A writer MAY produce a canonical document; a reader MUST NOT require one, since order carries no
meaning and rule 5 discards a hint that is only ever an optimisation.

What the rules buy is the statement this specification actually wants to make:

> **Two NodeSet2 documents describe the same information model if and only if their canonical
> NodeSet-NDJSON forms are byte-identical.**

That is stronger than "nothing is lost", and it is a statement NodeSet2 XML cannot make at all. A
byte-level identity for a nodeset is something to hash, to sign, to cache by content, to diff
between two revisions of a companion specification, and to compare across implementations, where
today two files that say exactly the same thing may differ in bytes for reasons no reader is
allowed to care about.

**Annex I is where this belongs, and it is most of the way there already.** I.2 makes reading
order normative, which is rule 1 in another form and is the hard one. What it does not yet fix is
key order within an object, and it has no canonical-form statement to name. The argument above is
offered on that basis: not as a proposal for this format, which nobody exchanges, but as the one
idea from it that the normative format could take.

It also makes §8.2 cheap to satisfy for anyone who wants more than a node count: the digest of a
canonical document is a content hash, and publishing one costs a writer nothing.

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

A bump is also the only way to invalidate stored documents when a *producer* becomes more faithful,
that is, when a reader learns to read something it used to drop. Every document written before is still
valid under its schema and still parses; it is simply less faithful than the file it came from, and
neither its `sourceDigest` nor its `sourceLength` can reveal that, because the source did not
change. Part of schema 3 was bumped for exactly that reason.

Version history:

| `schema` | Change |
|---|---|
| 1 | initial |
| 2 | the §7.2 inverse-declaration hint |
| 3 | the default table of §7.1; `definition.isOptionSet`, which the reader had been dropping; DateTime values, which it had not been reading at all |

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

- **NodeSet2 XML** (`Opc.Ua.NodeSet2.xsd`): the normative form of a nodeset document. This
  specification is defined by reference to it and adds nothing to the information model.
- **OPC 10000-6 Annex I**: the normative JSON form, and what node-opcua reads and writes for
  exchange (§2). The two formats answer different questions and this one has withdrawn from
  Annex I's. Where they overlap, §2.2 measures the difference and §2.4 records the one thing
  this format should adopt from it.
- **OPC UA JSON encoding** (Part 6 clause 5.4): a wire encoding for *values and messages*, not
  for documents. It does not describe nodes, references or a nodeset, and NodeSet-NDJSON does
  not attempt to be a superset of it. Where the two describe the same thing they agree in
  substance and differ in spelling: Part 6 optimises for a general JSON consumer, this format
  for a nodeset that is 5 000 lines long. Aligning §6 on Part 6's spellings would cost size
  (Part 6 spells a NodeId as an object with named fields where §6.1 spells the common case as
  one number, and it has no equivalent of the §7.1 default table) and buy this format nothing it
  needs, now that the format it has to interoperate with is Annex I rather than a general JSON
  consumer. §6.4 already adopts Part 6's spelling for 64-bit integers, where doing so costs
  nothing. `node-opcua-json` implements clause 5.4, and Annex I carries its Variants in it.
- **UA Binary**: smaller still, and unreadable. A nodeset is a document that people review
  and diff, and a text format that a human can `grep` has value that a binary one does not.
  NDJSON keeps that: one node per line means `grep` finds a node.

## 13. Acknowledgements

The format grew out of the node-opcua loader, and its shape owes a great deal to what the
NodeSet2 XML reader had to do first.

---

## Appendix A. Measurements

The 33 nodesets published with node-opcua 2.181, 19 859 nodes in total.

Both forms compressed the same way, gzip level 9, so the comparison is like for like.

| | XML | XML gzip | NDJSON | NDJSON gzip |
|---|---|---|---|---|
| total | 15 209 385 | 961 258 | 6 408 671 | **694 687** |
| smaller than the XML in the same state | - | - | **58 %** | **28 %** |

The seven largest documents, gzipped both ways:

| Nodeset | XML gzip | NDJSON gzip | smaller by |
|---|---|---|---|
| `Opc.Ua.NodeSet2` | 261 455 | 188 569 | 28 % |
| `Opc.Ua.Ijt.Base.NodeSet2` | 68 637 | 48 405 | 29 % |
| `Opc.Ua.Scales.NodeSet2` | 57 338 | 39 951 | 30 % |
| `Opc.Ua.Woodworking.NodeSet2` | 57 263 | 44 064 | 23 % |
| `Opc.Ua.MachineVision.NodeSet2` | 37 955 | 26 461 | 30 % |
| `Opc.Ua.CNC.NodeSet` | 37 786 | 27 334 | 28 % |
| `Opc.Ua.LADS.NodeSet2` | 35 683 | 27 535 | 23 % |
| **all 33** | **961 258** | **694 687** | **28 %** |

The honest reading: 28 % over the catalogue against the fair baseline, and between 8 % and
48 % on an individual document, depending on how much of it is markup and how much is prose
a compressor cannot help with. Worth having; not, on its own, worth reorganising a
specification for. Uncompressed, which is what a parser and an embedded device actually
work on, it is 58 % smaller.

These figures are lower than an earlier draft of this document reported, and deliberately
so: that draft dropped `<Category>`, `<Documentation>` and `<Extensions>` (§9.3).
Carrying them costs about four points of compressed size, which is the correct price for a
format that claims to carry the document.

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

## Appendix B. A complete small document

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

## Appendix C. Loading performance in node-opcua

Measured on the reference implementation, node-opcua 2.181 on Node.js 22.22.3, Windows 11,
loading each nodeset with its full dependency chain and the sibling-image cache disabled so
that each form is read from disk on every run.

Taken on an idle machine on mains power, best of fifty runs for the warm figures and best of
five fresh processes for the cold ones, after the format grew to carry Category, Documentation
and Extensions.

One methodological note, because an earlier draft of this document got it wrong and printed a
result that was not true. The harness read each file from disk *inside* the timed region, which
put the storage and, on Windows, the virus scanner into every measurement: a 4 MB XML read
against a 184 KB image read, fifty times over. It made the warm figures swing by a factor of two
between runs and once reported NDJSON as slower than XML, which is not a result about either
format. The files are now read once, before anything is timed, and the harness prints the median
beside the minimum so that a run the machine interfered with is visible rather than quotable.

**A whole address space, in a fresh process**: one load per process, JIT warm-up included,
best of three processes. This is what a server start pays.

| Loaded | Nodes | XML | NDJSON | faster by |
|---|---|---|---|---|
| the standard nodeset alone | 5 476 | 313 ms | 239 ms | 24 % |
| standard + DI | 5 923 | 381 ms | 274 ms | 28 % |
| + IA + Machinery | 6 225 | 389 ms | 288 ms | 26 % |
| + MachineTool | 7 132 | 457 ms | 306 ms | 33 % |

**The same, warm**, best of fifty loads in one process, so the JIT has settled. This is what a
long-running process re-loading a model pays, and the gap is wider because the parse is a larger
share of a load that no longer includes JIT warm-up:

| Loaded | XML | NDJSON | faster by |
|---|---|---|---|
| the standard nodeset alone | 126 ms | 70 ms | 44 % |
| standard + DI | 139 ms | 78 ms | 44 % |
| + IA + Machinery | 160 ms | 85 ms | 47 % |
| + MachineTool | 193 ms | 101 ms | 48 % |

**The parse phase alone**: source bytes to the record stream, no address space built:

| Document | Records | XML | NDJSON | faster by |
|---|---|---|---|---|
| `Opc.Ua.NodeSet2` | 5 477 | 61 ms | 20 ms | 67 % |
| `Opc.Ua.Scales.NodeSet2` | 1 349 | 15 ms | 5 ms | 67 % |
| `Opc.Ua.Di.NodeSet2` | 448 | 5 ms | 1 ms | 67 % |

Two thirds, on documents that differ in size by a factor of twelve.

**What compression costs**, which is the question anyone shipping a catalogue asks. The same
standard nodeset, warm, best of fifty, in each of the four forms a deployment can actually put
on disk:

| Form | Size | Parse | Whole load |
|---|---|---|---|
| NodeSet2 XML | 4 034 KB | 65 ms | 131 ms |
| NodeSet2 XML, gzip, inflate included | 255 KB | 68 ms | 135 ms |
| NodeSet-NDJSON, gzip | 184 KB | 20 ms | 72 ms |
| NodeSet-NDJSON, uncompressed | 1 969 KB | 16 ms | 67 ms |

Inflating the image costs 2.1 ms, against a parse of 20 and a load of 72. **Compression is very
nearly free on the read side**, which is why §4.2 recommends a high level without qualification:
a writer trades 2 ms of the reader's time for ninety per cent of the bytes. Shipping the NDJSON
uncompressed buys about 6 % of a load and costs ten times the storage, which is a bad trade in
almost every deployment. Gzipping the XML, by contrast, buys nothing at load time at all: it is
still 255 KB against 184, and still takes 135 ms against 72.

Read the tables together and they say something worth stating plainly, because it bears on what
this format is for.

**Parsing is about 67 % faster, and that buys 24 to 33 per cent off a cold whole load and 44 to
48 per cent off a warm one, because parsing is not what dominates a load.** What dominates is
building it: creating nodes, resolving and installing references, binding extension object
values, running the post-load passes. That work is *almost* identical whichever form the records
came from, and the small difference is measurable: the apply phase is 66 ms from XML against
52 ms from an image, because the image carries the §7.2 inverse-declaration hints and the loader
can skip the sweep that looks for the references a document declared only once.

So the case for NodeSet-NDJSON does not rest on load time. It rests on **canonicality**
(§9.4), which is not a performance property at all, and secondarily on **size**: 58 %
uncompressed, 28 % gzipped, against the same document in the same state. The load-time gain is
real, consistent, and the smallest of the three; an implementation adopting this format to make
its server start faster is adopting it for the least of what it offers.

A note for implementers, since it was worth two of the milliseconds above: gzip inflation is
about a third of the NDJSON parse phase. Inflating a whole image once with the platform's
native zlib, rather than streaming it, is measurably cheaper on a document of this size, and
it moves the work off the main thread where the runtime supports it.
