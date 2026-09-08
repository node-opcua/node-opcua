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

That is the job. Get the model once, export it, and let a graph database answer.

## What comes out

```jsonc
{
  "@context":  { /* prefixes, property terms, and per-document predicates */ },
  "@graph":    [ /* the ontology node, then one entry per node */ ],
  "@included": [ /* OWL property declarations, and foreign attachments */ ]
}
```

The first `@graph` entry describes the model itself, as both a `uardf:UANodeSet` and an
`owl:Ontology`. Every entry after it is a node:

```jsonc
{
  "@id": "di:DeviceType",
  "@type": ["uardf:UAObjectType", "owl:Class"],
  "nodeId": "nsu=http://opcfoundation.org/UA/DI/;i=1002",
  "browseName": "nsu=http://opcfoundation.org/UA/DI/;DeviceType",
  "name": "DeviceType",
  "subClassOf": "di:ComponentType",
  "di:ParameterSet": "di:bnN1PWh0dHA6..."
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
DataTypes are kept, with their `DataTypeDefinition`. On the DI nodeset that is 14 nodes of 447.

[`VOCABULARY.md`](./VOCABULARY.md) is the full account: prefixes, IRI minting, the ontology node,
type composition, the reference rules, the three kinds of `@included` entry.

## Which entry point

That document can be produced two ways, and each has an entry point of its own so that neither
drags in what only the other needs.

| | [`/address-space`](#node-opcua-uanodeset-rdfaddress-space) | [`/session`](#node-opcua-uanodeset-rdfsession) |
|---|---|---|
| you have | the NodeSet2 document | an `OPCUAClient` or a `PseudoSession` |
| covers | every node of the namespace | every node reachable by browsing |
| `symbolicName` | yes | no |
| `owl:imports` | yes | no |

Prefer `/address-space` when you have the document. Reach for `/session` when you do not, which
for a vendor's own companion specification is often the only option there is.

The root module re-exports both, for callers that want both.

---

# `node-opcua-uanodeset-rdf/address-space`

The complete source. An address space retains the NodeSet2 metadata that OPC UA has no attribute
for, so an export taken this way is the reference the other is judged against.

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

A whole address space is needed rather than the one namespace, and that is not an implementation
detail: a type's IRI is its BrowseName, including for types belonging to the models this one
merely imports, so the exporter has to resolve NodeIds it never read.

Two fields of the ontology node are written in the source document's `Models` element and are not
retained by the loader. Supply them if you want them in the output:

```ts
import { addressSpaceToJsonLd } from "node-opcua-uanodeset-rdf/address-space";

const doc = addressSpaceToJsonLd(addressSpace, {
    modelUri: "http://opcfoundation.org/UA/DI/",
    model: { modelVersion: "1.5.0", xmlSchemaUri: "http://opcfoundation.org/UA/DI/Types.xsd" }
});
```

| export | what it is |
|---|---|
| `addressSpaceToJsonLdText(addressSpace, options?)` | one namespace as a JSON-LD document, serialised |
| `addressSpaceToJsonLd(addressSpace, options?)` | the same as a plain object, to hand to a JSON-LD library |
| `addressSpaceToRdfModel(addressSpace, modelUri?)` | the collected model, to inspect or amend before mapping it |

---

# `node-opcua-uanodeset-rdf/session`

Nothing reachable from this entry point mentions `node-opcua-address-space`, at the type level or
the runtime one, so a client application uses it without loading the address-space machinery it
has no other use for.

## With an `OPCUAClient`

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

## With a `PseudoSession`

`PseudoSession` puts the session interface in front of an address space you already hold. No
server, no socket, no endpoint.

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

It is also how this entry point is tested. Both paths then see the same model, so every
difference between the two documents is something OPC UA cannot say about a node rather than
something the collector got wrong.

## What a session has to provide

`RdfSession` is not a session type. It is the three services collecting a model actually calls:

```ts
type RdfSession = IBasicSessionBrowseAsyncMultiple &
    IBasicSessionBrowseNextAsyncMultiple &
    IBasicSessionReadAsyncMultiple;
```

Browse, follow the continuation point a browse hands back, read attributes. `create`, `close`,
subscriptions and the rest of a session's surface are deliberately outside it, so a caller may
pass something much smaller than a session.

Browse is chunked by the server's own `MaxNodesPerBrowse` and `MaxBrowseContinuationPoints`,
which `browseAll` reads for itself. Attribute reads use a fixed modest batch: honouring a
server's `MaxNodesPerRead` belongs in a client that specialises in it, not in an exporter.

## What a session cannot tell you

Three differences from the address-space export, all structural rather than unfinished work, each
measured by exporting one DI address space both ways.

- **No service lists the nodes of a namespace.** Browse walks references; nothing enumerates. So
  the model is whatever a crawl from Root reaches, and a node nothing points at is invisible. On
  DI that is exactly nine: the well-known function-group Objects `Configuration`, `Tuning`,
  `Maintenance`, `Diagnostics`, `Statistics`, `Status`, `Operational`, `OperationCounters` and
  `Identification`, which carry no inverse reference of any type.
- **`SymbolicName` is not an attribute.** It is NodeSet2 metadata, so `uardf:symbolicName` is
  absent from every entry.
- **`NamespaceMetadataType` states no required models.** It carries `NamespaceUri`,
  `NamespaceVersion` and `NamespacePublicationDate` and no list of imports, so the ontology node
  has `version` and `publicationDate` but no `requiredModels` and no `owl:imports`.

Everything else agrees, node for node and predicate for predicate: the same `@id`, `@type`,
`dataType`, `value` and children, the same `@context` terms, the same `@included` entries.

| export | what it is |
|---|---|
| `sessionToJsonLdText(session, options?)` | one namespace as a JSON-LD document, serialised |
| `sessionToJsonLd(session, options?)` | the same as a plain object |
| `sessionToRdfModel(session, modelUri?)` | the collected model, to inspect or amend before mapping it |
| `RdfSession` | the intersection above |

---

## Shared API

Both entry points also export:

| export | what it is |
|---|---|
| `JsonLdOptions` | `{ modelUri?, model?: { xmlSchemaUri?, modelVersion? } }` |
| `modelToJsonLd(model, options?)` | the mapping itself, for a model collected some third way |
| `RdfModel`, `RdfNode`, `RdfReference`, `RdfTarget` | the collected model's types |
| `UARDF` | `http://opcfoundation.org/rdf/uacore#`, the vocabulary namespace |
| `OPCUA_NAMESPACE` | `http://opcfoundation.org/UA/` |
| `prefixOfNamespace(uri)` | the prefix a namespace URI gets: its last non-empty path segment, lowercased |

Collecting a model and mapping it are separate on purpose. `modelToJsonLd` is synchronous and
reads nothing but an `RdfModel`, which is why the session collector could be added without
touching a line of the vocabulary, and why a third source would need no more than a function
returning an `RdfModel`.

## Status

**This is an export, not a serialisation format.** There is no reader, and it never registers
with the address-space loader. To read or write a JSON nodeset you want
[`node-opcua-uanodeset-json`](../node-opcua-uanodeset-json), which implements the normative
Annex I formats. The two answer different questions: Annex I is how a model is exchanged, this is
how a model is queried.

**The vocabulary is not in the specification.** OPC 10000-6 Annex I runs I.1 to I.24 and has no
RDF section. This vocabulary belongs to the OPC Foundation's `UA-NodeSetTool`, whose own
`rdf_prototype.md` no longer describes what it emits, so its output *is* the specification and
`VOCABULARY.md` is a reverse-engineered account of it.

**Parity** with that tool, measured on `Opc.Ua.Di.NodeSet2`:

| | reference tool | this package |
|---|---|---|
| `@graph` entries | 434 | **434** |
| `@included` entries | 172 | 173 |
| `@context` terms | 239 | 220 |
| entries byte-identical | n/a | 66 of 434 |

Graph membership matches exactly, so a query over either document sees the same nodes. It is not
yet byte-identical, and with no reader there is no round trip, no fixpoint and no digest
equivalence to lean on: a diff against the reference implementation is the only oracle. The gap
is one undocumented rule, whether a child is written under a BrowseName-derived predicate or
under the generic reference type. Three hypotheses were tested and all three failed, so the
question is recorded in `VOCABULARY.md` rather than answered with a rule that merely fits one
nodeset.

## On the name

`node-opcua-nodeset-*` is a reserved prefix. The nodeset code generator sweeps every folder
matching it and rewrites `packages/tsconfig.json` from what it finds, so a hand-written package
sitting there breaks `generate:nodesets`. Hence `uanodeset`, matching
`node-opcua-uanodeset-json`.

## License

MIT
