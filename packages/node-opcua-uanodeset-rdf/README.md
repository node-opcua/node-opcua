# node-opcua-uanodeset-rdf

Export an OPC UA information model as **JSON-LD**, so it can be queried with SPARQL, reasoned
over with an OWL toolchain, or joined to data that was never OPC UA in the first place.

see http://node-opcua.github.io/

```bash
npm install node-opcua-uanodeset-rdf
```

## Why

An address space is already a graph: nodes, typed edges, subtype chains. What it lacks is a way
to ask graph questions of it. `HasComponent` is a traversal in an SDK, but a *predicate* in RDF,
and once the model is in a triple store you can ask things the OPC UA services have no method
for:

> every DataType in this model with a field whose own DataType is not defined by any model I
> imported

> the transitive closure of `HasSubtype` under `DeviceType`, across DI and a vendor companion
> specification loaded side by side

> which nodes changed between two published versions of a companion specification

That is the job. Load the model once, export it, and let a graph database answer.

## Quick start

```ts
import { writeFile } from "node:fs/promises";
import { AddressSpace, generateAddressSpace } from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";
import { addressSpaceToJsonLdText } from "node-opcua-uanodeset-rdf";

const addressSpace = AddressSpace.create();
await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);

// with no modelUri, the last namespace loaded is the one exported
await writeFile("Opc.Ua.Di.jsonld", addressSpaceToJsonLdText(addressSpace), "utf8");

addressSpace.dispose();
```

The exporter takes a **live address space** rather than a stream of records, and that is not an
implementation detail: a type's IRI is its BrowseName, including for types belonging to the
models this one merely imports, so the exporter has to resolve NodeIds it never read.

Two fields of the ontology node are written in the source document's `Models` element and are not
retained by the loader. Supply them if you want them in the output:

```ts
import { addressSpaceToJsonLd } from "node-opcua-uanodeset-rdf";

const doc = addressSpaceToJsonLd(addressSpace, {
    modelUri: "http://opcfoundation.org/UA/DI/",
    model: { modelVersion: "1.5.0", xmlSchemaUri: "http://opcfoundation.org/UA/DI/Types.xsd" }
});
```

## What comes out

```jsonc
{
  "@context":  { /* prefixes, property terms, and per-document predicates */ },
  "@graph":    [ /* the ontology node, then one entry per node */ ],
  "@included": [ /* OWL property declarations, and foreign attachments */ ]
}
```

The first `@graph` entry describes the model itself, as both a `uardf:UANodeSet` and an
`owl:Ontology`, with `owl:imports` for each required model. Every entry after it is a node:

```jsonc
{
  "@id": "di:DeviceType",
  "@type": ["uardf:UAObjectType", "owl:Class"],
  "nodeId": "nsu=http://opcfoundation.org/UA/DI/;i=1002",
  "browseName": "nsu=http://opcfoundation.org/UA/DI/;DeviceType",
  "name": "DeviceType",
  "subClassOf": { "@id": "opcua:TopologyElementType" },
  "di:ParameterSet": { "@id": "di:bnN1PWh0dHA6..." }
}
```

Three ideas carry most of the mapping:

- **Types get readable IRIs, instances get stable ones.** An ObjectType, VariableType,
  ReferenceType or DataType is `<prefix>:<BrowseName>`; everything else is
  `<prefix>:<base64url(canonical NodeId)>`, unpadded. So `di:DeviceType` is legible in a query
  and an instance IRI survives a renaming.
- **Three references become fields rather than edges.** `HasTypeDefinition` becomes part of
  `@type` (a Property is `["uardf:UAVariable", "opcua:PropertyType"]`), `HasSubtype` becomes
  `subClassOf`, and `HasModellingRule` becomes `modellingRule`. That is what makes the OWL
  reasoning work: a subtype chain is a class hierarchy.
- **`@included` carries the schema.** One `owl:ObjectProperty` declaration per reference type the
  model defines, with its inverse and its `subPropertyOf`, so a reasoner knows what the
  predicates mean.

The legacy OPC Binary machinery is dropped: every node whose TypeDefinition is
`DataTypeDictionaryType` or `DataTypeDescriptionType`, and everything they own. The structure
DataTypes are kept, with their `DataTypeDefinition`. On the DI nodeset that is 14 nodes of 448.

[`VOCABULARY.md`](./VOCABULARY.md) is the full account: prefixes, IRI minting, the ontology node,
type composition, the reference rules, the three kinds of `@included` entry.

## API

| export | what it is |
|---|---|
| `addressSpaceToJsonLdText(addressSpace, options?)` | one namespace as a JSON-LD document, serialised |
| `addressSpaceToJsonLd(addressSpace, options?)` | the same as a plain object, to hand to a JSON-LD library |
| `JsonLdOptions` | `{ modelUri?, model?: { xmlSchemaUri?, modelVersion? } }` |
| `UARDF` | `http://opcfoundation.org/rdf/uacore#`, the vocabulary namespace |
| `OPCUA_NAMESPACE` | `http://opcfoundation.org/UA/` |
| `prefixOfNamespace(uri)` | the prefix a namespace URI gets: its last non-empty path segment, lowercased |

## Scope and status

**This is an export, not a serialisation format.** There is no reader, and it never registers
with the address-space loader. If you want to read or write a JSON nodeset, you want
[`node-opcua-uanodeset-json`](../node-opcua-uanodeset-json), which implements the normative
Annex I formats. The two answer different questions: Annex I is how a model is exchanged, this is
how a model is queried.

**The vocabulary is not in the specification.** OPC 10000-6 Annex I runs I.1 to I.24 and has no
RDF section. This vocabulary belongs to the OPC Foundation's `UA-NodeSetTool`, whose own
`rdf_prototype.md` no longer describes what it emits, so its output *is* the specification and
`VOCABULARY.md` is a reverse-engineered account of it.

**Parity**, measured on `Opc.Ua.Di.NodeSet2`:

| | reference tool | this package |
|---|---|---|
| `@graph` entries | 434 | **434** |
| `@included` entries | 172 | 173 |
| `@context` terms | 239 | 220 |
| entries byte-identical | n/a | 66 of 434 |

Graph membership matches exactly, so a query over either document sees the same nodes. It is not
yet byte-identical, and since there is no reader there is no round trip, no fixpoint and no
digest equivalence to lean on: a diff against the reference implementation is the only oracle.
The gap is one undocumented rule, whether a child is written under a BrowseName-derived predicate
or under the generic reference type. Three hypotheses were tested and all three failed, so the
question is recorded in `VOCABULARY.md` rather than answered with a rule that merely fits one
nodeset.

## On the name

`node-opcua-nodeset-*` is a reserved prefix. The nodeset code generator sweeps every folder
matching it and rewrites `packages/tsconfig.json` from what it finds, so a hand-written package
sitting there breaks `generate:nodesets`. Hence `uanodeset`, matching
`node-opcua-uanodeset-json`.

## License

MIT
