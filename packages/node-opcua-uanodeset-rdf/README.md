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

## Two ways in

The model can come from a **loaded address space** or from a **live session**, and each has its
own entry point so that neither drags in what only the other needs.

```ts
import { addressSpaceToJsonLdText } from "node-opcua-uanodeset-rdf/address-space";
import { sessionToJsonLdText } from "node-opcua-uanodeset-rdf/session";
```

`/session` does not mention `node-opcua-address-space` at any level, so a client application
exports a server's model without loading the address-space machinery it has no other use for.
The root `node-opcua-uanodeset-rdf` re-exports both, for callers that want both.

| | `/address-space` | `/session` |
|---|---|---|
| needs | the NodeSet2 document | a server you can browse |
| completeness | every node, every field | every node a crawl from Root reaches |
| `SymbolicName` | yes | no, it is not an attribute |
| `owl:imports` | yes | no, `NamespaceMetadataType` states no imports |

Prefer `/address-space` where you have the document. Reach for `/session` when you do not, which
for a vendor's own companion specification is often the only option there is.

## Quick start: from a nodeset

```ts
import { writeFile } from "node:fs/promises";
import { AddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { addressSpaceToJsonLdText } from "node-opcua-uanodeset-rdf/address-space";

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
import { addressSpaceToJsonLd } from "node-opcua-uanodeset-rdf/address-space";

const doc = addressSpaceToJsonLd(addressSpace, {
    modelUri: "http://opcfoundation.org/UA/DI/",
    model: { modelVersion: "1.5.0", xmlSchemaUri: "http://opcfoundation.org/UA/DI/Types.xsd" }
});
```

## Quick start: from a running server

This is the case a nodeset file cannot serve: a device implementing a companion specification you
do not have, exported straight into a triple store.

```ts
import { writeFile } from "node:fs/promises";
import { OPCUAClient } from "node-opcua-client";
import { sessionToJsonLdText } from "node-opcua-uanodeset-rdf/session";

await OPCUAClient.create({ endpointMustExist: false }).withSessionAsync(
    "opc.tcp://localhost:26543",
    async (session) => {
        const jsonld = await sessionToJsonLdText(session, {
            modelUri: "http://acme.com/UA/Widget/"
        });
        await writeFile("Widget.jsonld", jsonld, "utf8");
    }
);
```

## Quick start: from a PseudoSession

`PseudoSession` puts the session interface in front of an address space you already have. It
needs no server, no socket and no endpoint, so it is the quick way to try the session path, and
it is also how this package tests it: the same model exported both ways differs only in the rows
of the table above.

```ts
import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { sessionToJsonLdText } from "node-opcua-uanodeset-rdf/session";

const addressSpace = AddressSpace.create();
await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);

const jsonld = await sessionToJsonLdText(new PseudoSession(addressSpace), {
    modelUri: "http://opcfoundation.org/UA/DI/"
});

addressSpace.dispose();
```

### What a session has to provide

`RdfSession` is not a session type, it is the three services collecting a model actually uses:

```ts
type RdfSession = IBasicSessionBrowseAsyncMultiple &
    IBasicSessionBrowseNextAsyncMultiple &
    IBasicSessionReadAsyncMultiple;
```

Browse, follow the continuation point a browse hands back, read attributes. `create`, `close`,
subscriptions and the rest of a session's surface are deliberately not in it, so a caller can
pass something much smaller than a session if they have one.

Browse is chunked by the server's own `MaxNodesPerBrowse` and `MaxBrowseContinuationPoints`,
which `browseAll` reads for itself. Attribute reads use a fixed modest batch: honouring a
server's `MaxNodesPerRead` belongs in a client that specialises in it, not in an exporter.

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

Both entry points export the vocabulary helpers, `JsonLdOptions` and `modelToJsonLd`; each adds
its own way of collecting a model.

| `/address-space` | what it is |
|---|---|
| `addressSpaceToJsonLdText(addressSpace, options?)` | one namespace as a JSON-LD document, serialised |
| `addressSpaceToJsonLd(addressSpace, options?)` | the same as a plain object, to hand to a JSON-LD library |
| `addressSpaceToRdfModel(addressSpace, modelUri?)` | the collected model, if you want to inspect or amend it first |

| `/session` | what it is |
|---|---|
| `sessionToJsonLdText(session, options?)` | one namespace of a server, serialised |
| `sessionToJsonLd(session, options?)` | the same as a plain object |
| `sessionToRdfModel(session, modelUri?)` | the collected model |
| `RdfSession` | the three services this needs: browse, browseNext, read |

| shared | what it is |
|---|---|
| `JsonLdOptions` | `{ modelUri?, model?: { xmlSchemaUri?, modelVersion? } }` |
| `modelToJsonLd(model, options?)` | the mapping itself, for a model you collected some third way |
| `RdfModel`, `RdfNode`, `RdfReference`, `RdfTarget` | the collected model's types |
| `UARDF` | `http://opcfoundation.org/rdf/uacore#`, the vocabulary namespace |
| `OPCUA_NAMESPACE` | `http://opcfoundation.org/UA/` |
| `prefixOfNamespace(uri)` | the prefix a namespace URI gets: its last non-empty path segment, lowercased |

Collection and mapping are separate on purpose. `modelToJsonLd` is synchronous and reads nothing
but an `RdfModel`, which is why a session collector could be added without touching a line of the
vocabulary, and why a third source would need no more than a function returning an `RdfModel`.

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

**A session-sourced export is not the equal of a nodeset-sourced one**, and the difference is
structural rather than unfinished work. OPC UA has no service that lists the nodes of a
namespace, so a crawl from Root is the best available and a node nothing points at is invisible:
on DI that is exactly nine, the well-known function-group Objects, which carry no inverse
reference of any type. `SymbolicName` is NodeSet2 metadata rather than an attribute, and
`NamespaceMetadataType` states no required models, so there is no `owl:imports`. Everything else
agrees, node for node and predicate for predicate, which the package's tests check by exporting
one address space both ways. "What a session cannot tell you" in `VOCABULARY.md` is the full
account.

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
