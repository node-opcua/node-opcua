# The OPC UA JSON-LD vocabulary

This is a **reverse-engineered** description of the JSON-LD an OPC UA information model is
exported as by `OPCF-Members/UA-NodeSetTool`. It is written down here because no accurate
description existed: the tool's own `rdf_prototype.md` describes an earlier shape, and the
differences are not small.

Nothing here is normative. **OPC 10000-6 Annex I has no RDF section** — the annex runs I.1 to
I.24 and stops at `DataTypeField`. This vocabulary is the reference implementation's own.

Everything below was established by generating output for real nodesets and reading it. Where a
rule could not be established, it says so rather than guessing.

---

## Document shape

```jsonc
{
  "@context":  { /* prefixes, property terms, and per-document predicates */ },
  "@graph":    [ /* the ontology node, then one entry per node */ ],
  "@included": [ /* OWL property declarations, and foreign attachments */ ]
}
```

There is no root `@id` and no root `@type`. (`rdf_prototype.md` describes both, plus `modelUri`,
`version` and `requiredModels` at the root, and nodes flagged `isNormative` / `isExternal`. None
of that is emitted.)

## Prefixes

| prefix | expands to |
|---|---|
| `opcua` | `http://opcfoundation.org/UA/` |
| `uardf` | `http://opcfoundation.org/rdf/uacore#` |
| `owl` | `http://www.w3.org/2002/07/owl#` |
| `rdfs` | `http://www.w3.org/2000/01/rdf-schema#` |
| `xsd` | `http://www.w3.org/2001/XMLSchema#` |
| *model* | the exported model's namespace URI |

The model's prefix is its namespace URI's **last non-empty path segment, lowercased** —
`http://opcfoundation.org/UA/DI/` becomes `di`.

Note the vocabulary prefix is `uardf`, **not** `opcua` as `rdf_prototype.md` states. Only the
reference types and BrowseName-derived predicates live under `opcua:`.

## Node identity

| node kind | IRI |
|---|---|
| ObjectType, VariableType, ReferenceType, DataType | `<prefix>:<BrowseName>` |
| everything else | `<prefix>:<base64url(canonical NodeId)>` |

The canonical NodeId is the Annex I form (`i=85`, or `nsu=<uri>;i=85`), base64url encoded
**without padding**. So `nsu=http://opcfoundation.org/UA/DI/;i=6450` becomes
`di:bnN1PWh0dHA6Ly9vcGNmb3VuZGF0aW9uLm9yZy9VQS9ESS87aT02NDUw`.

## The ontology node

The first entry of `@graph` describes the model itself:

```jsonc
{
  "@id": "http://opcfoundation.org/UA/DI/",
  "@type": ["uardf:UANodeSet", "owl:Ontology"],
  "modelUri": "...", "xmlSchemaUri": "...",
  "version": "1.05.0", "modelVersion": "1.5.0",
  "owl:versionInfo": "1.5.0",
  "owl:versionIRI": { "@id": "<modelUri><modelVersion>" },
  "publicationDate": "2025-11-15T00:00:00Z",
  "requiredModels": [ { "modelUri": "...", "version": "...", "publicationDate": "..." } ],
  "owl:imports": [ { "@id": "http://opcfoundation.org/UA/" } ]
}
```

`xmlSchemaUri` and `modelVersion` are written in the source document's `Models` element and are
**not retained by node-opcua's address space**, so this package takes them through
`JsonLdOptions.model` rather than inventing them.

## Node entries

Every node carries `@id`, `@type`, `nodeId`, `namespaceUri`, `browseName` and `name`.
`browseName` is the Annex I QualifiedName form (bare in namespace 0, `nsu=<uri>;<name>`
otherwise); `name` is the bare BrowseName.

`@type` is `uardf:UAObject`, `uardf:UAVariable`, `uardf:UAMethod`, `uardf:UAObjectType`,
`uardf:UAVariableType`, `uardf:UAReferenceType`, `uardf:UADataType` or `uardf:UAView`, plus:

- `owl:Class` for the four type NodeClasses;
- the **TypeDefinition's IRI** for instances, so a Property is `["uardf:UAVariable",
  "opcua:PropertyType"]`.

Other fields: `subClassOf` (from the inverse `HasSubtype`), `parent`, `symbolicName`,
`description` as a language map (`{"@none": "..."}` when no locale), `dataType`, `valueRank`
(omitted when scalar), `arrayDimensions`, `definition`, and `value` as a raw Part 6 1.05 JSON
Variant carried as a `@json` literal.

## References

`HasTypeDefinition`, `HasModellingRule` and `HasSubtype` are never written as references:
the first two become `@type` and `modellingRule`, the third becomes `subClassOf`.

Everything else is written one of two ways:

- **as a predicate named after the child's BrowseName** — `di:ParameterSet`, `opcua:EnumStrings`;
- **as a predicate named after the reference type** — `opcua:HasComponent`, whose value is an
  array when several children share it.

**The rule choosing between the two is not established.** Observed on the DI nodeset:
`IdleToPreparing` and `ParameterSet` get BrowseName predicates; `Idle`, `Error`, `Installing`
and `Abort` do not, and appear under `opcua:HasComponent` instead. It is not name uniqueness
(`PercentComplete` occurs twice and *does* get one; `Error` occurs once and does not), and it is
not the NodeClass or the reference type (States and Transitions are both Objects reached by
`HasComponent`, and they differ). **This is the open question to put to the maintainer.**

A BrowseName that names a placeholder (`<ParameterIdentifier>`) never becomes a predicate.

## `@included`

Three kinds of entry:

1. **ReferenceType declarations**, one per reference type the model defines:
   `{"@id", "@type": "owl:ObjectProperty", "label", "symmetric", "inverseOf", "inverseName",
   "subPropertyOf"}`. A symmetric type is its own inverse.
2. **Predicate declarations**, one per BrowseName-derived predicate, minimal:
   `{"@id", "@type": "owl:ObjectProperty", "subPropertyOf": "<the reference type reaching it>"}`.
3. **Foreign attachments**: a node in *another* model that this model hangs children on, written
   as `{"@id": "<that node>", "<predicate>": "<child>"}` with no `@type`. It cannot go in
   `@graph`, because the document does not define that node.

## What is dropped

The legacy OPC Binary machinery: every node whose TypeDefinition is `DataTypeDictionaryType`
(`i=72`) or `DataTypeDescriptionType` (`i=69`), **and everything those nodes own**. The structure
DataTypes themselves are kept, with their `DataTypeDefinition`; only the encoding dictionaries and
description blobs go. On the DI nodeset that is 14 nodes of 448.

---

## Parity status of this implementation

Measured against the reference implementation for `Opc.Ua.Di.NodeSet2`:

| | reference | this package |
|---|---|---|
| `@graph` entries | 434 | **434** |
| `@included` entries | 172 | 173 |
| `@context` terms | 239 | 220 |
| entries byte-identical | — | 66 of 434 |

`@graph` membership matches exactly. The remaining differences are concentrated in which
predicate a child is written under (the open question above) and in the reference-type aliases
that `@context` needs so the `subPropertyOf` values in `@included` resolve.

**This exporter is not yet a drop-in replacement**, and the numbers above are the honest state of
it rather than an aspiration.

---

## What a session cannot tell you

The same document can be produced from a live session
(`node-opcua-uanodeset-rdf/session`) rather than a loaded address space. That is the only way to
export a server whose nodeset file you do not have, and it is not the equal of the address-space
path. Three differences are structural, not defects waiting to be fixed, and each was measured on
DI by exporting the same address space both ways.

**1. There is no service that lists the nodes of a namespace.** Browse walks references; nothing
enumerates. So a session-sourced model is whatever a crawl from Root reaches, and a node nothing
points at is invisible. On DI that is nine nodes: the well-known function-group Objects
`Configuration`, `Tuning`, `Maintenance`, `Diagnostics`, `Statistics`, `Status`, `Operational`,
`OperationCounters` and `Identification`. They carry no inverse reference of any type, so no crawl
from any root reaches them. Every other node of the namespace is reached, and each is written with
the same `@id`, `@type`, `dataType`, `value` and predicates as the address-space export gives it.

**2. `SymbolicName` is not an attribute.** It is NodeSet2 metadata, so `uardf:symbolicName` is
absent from every entry of a session-sourced document.

**3. `NamespaceMetadataType` states no required models.** It carries `NamespaceUri`,
`NamespaceVersion` and `NamespacePublicationDate`, and no list of imports. So the ontology node of
a session-sourced document has `version` and `publicationDate` but no `requiredModels` and no
`owl:imports`, which is what a reasoner uses to pull the imported models in. A caller that knows
the imports can still supply `xmlSchemaUri` and `modelVersion` through `JsonLdOptions.model`.

Everything else agrees: the `@context` terms, the `@included` entries, the drop rule for the
legacy OPC Binary machinery, and every predicate on every node reached.
