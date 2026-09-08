# node-opcua-uanodeset-json

The **JSON NodeSet** of OPC 10000-6 Annex I, in all three of its serialisations, readable and
writable by node-opcua.

see http://node-opcua.github.io/

```bash
npm install node-opcua-uanodeset-json
```

## Why

An information model has been a NodeSet2 XML document for as long as OPC UA has had one. Annex I
is the normative JSON form of the same thing, and it is what you want when the consumer is not an
OPC UA stack: a browser, a `jq` pipeline, a document database, a diff in a code review, or a
build step that has to add one node to a companion specification without a full XML toolchain.

The annex specifies three shapes of the same model, and this package implements all three:

| extension | Annex | what it is | reach for it when |
|---|---|---|---|
| `.jsonl` | I.4 | one JSON object per line, header first | you want to stream, `grep`, or diff a model line by line |
| `.json` | I.1 | one document, children nested inside their parent | you want to read it, or hand it to a JSON API |
| `.uanodeset` | I.3 | a TAR.GZ of a manifest and numbered members | the model is large enough that one file is unwieldy |

## Reading: nothing to call

Importing the package registers all three with the address-space loader, so a path is enough:

```ts
import { AddressSpace, generateAddressSpace } from "node-opcua-address-space";
import "node-opcua-uanodeset-json";

const addressSpace = AddressSpace.create();
await generateAddressSpace(addressSpace, [
    "Opc.Ua.NodeSet2.xml",     // still XML
    "Opc.Ua.Di.jsonl",         // Annex I line form
    "MyCompanionSpec.uanodeset" // Annex I archive
]);
```

`node-opcua-server` already imports it, so a server gets this for free. Formats are chosen by
**sniffing the content**, not the extension, and the head a sniffer is shown is already inflated,
so `.jsonl.gz` and `.json.gz` work as well and a misnamed file still loads.

To register only one form, import only that subpath. It is the point of the subpaths:

```ts
import "node-opcua-uanodeset-json/jsonl";
```

Reading is **exact**, and that claim is tested rather than asserted. The DI nodeset loaded from
`.jsonl`, `.json` and `.uanodeset` produces an address space with the same digest as the one
loaded from its NodeSet2 XML, where the digest hashes every node's id, browse name, class,
reference count and, for variables, status code and value. Agreeing node counts would not be that
claim.

## Writing

The writers take a stream of `NodesetRecord`, the intermediate form the loader produces, so
converting between any two formats is reading one and writing the other:

```ts
import { writeFile } from "node:fs/promises";
import { recordsToAnnexIJson } from "node-opcua-uanodeset-json";

await writeFile("Opc.Ua.Di.json", recordsToAnnexIJson(records), "utf8");
```

```ts
import zlib from "node:zlib";
import { recordsToAnnexIArchiveTar } from "node-opcua-uanodeset-json";

const tar = recordsToAnnexIArchiveTar(records, { maxNodesPerFile: 1000 });
await writeFile("Opc.Ua.Di.uanodeset", zlib.gzipSync(Buffer.from(tar)));
```

Writing is a **fixpoint**: `write(read(write(read(x))))` is byte-identical to `write(read(x))`,
for the document form and for the archive down to the tar bytes. Splitting an archive never
divides a subtree across two members, and the members carry no `Models`, because I.3 says the
manifest specifies them.

Cross-implementation, which is the check that actually matters: the OPC Foundation's
`UA-NodeSetTool` reads what this writes and its `compare` reports the result identical to the
original XML.

## What the annex does differently

Three decisions in I.1 will surprise a reader who knows NodeSet2 XML, and each one is why a
naive translation does not work:

- **No namespace table.** A NodeId embeds its namespace URI: `nsu=http://…/DI/;i=1002`, and a
  QualifiedName likewise. Nothing is relative to a document-scoped index, so a node can be moved
  between documents unchanged. `parseAnnexINodeId` and `formatAnnexINodeId` are the conversion,
  and they split on the **first** semicolon, since a URI may contain one.
- **No aliases.** Reference types are written out.
- **Three references are not references.** `HasTypeDefinition` becomes the `TypeId` field,
  `HasModellingRule` becomes `ModellingRuleId`, and the forward edge from a parent to its child
  is implied by `ParentId`. A reader that only walks `References` silently loses all three; this
  package puts them back.

The document form adds two more:

- Nodes are partitioned into **eight containers** by NodeClass, and children nest inside their
  parent's `ChildList` rather than sitting at the top level.
- `Ordered` and `Declarations` handle cycles. I.2 makes reading order normative so a decoder
  reading forwards never meets a NodeId it has not already seen, and `Declarations` carries stubs
  for the ones that cannot be ordered. A test model exists specifically to exercise this, because
  it is what breaks a naive reader.

## API

Most callers need only the side-effect import. The rest is for building tools.

| export | what it is |
|---|---|
| `recordsToAnnexIJson(records)` | records as an Annex I document, serialised |
| `recordsToAnnexIDocument(records)` | the same as an `AnnexIUANodeSet` object |
| `recordsToAnnexIArchiveTar(records, options?)` | records as the tar bytes of an archive, before gzip |
| `flattenAnnexIDocument(nodeSet)` | a document's nodes in I.2 reading order, un-nested, with `ParentId` filled in |
| `annexIHeaderRecord` / `annexINodeRecord` | the codec: Annex I to `NodesetRecord` |
| `decodeAnnexIVariant`, `AnnexIValueError` | a Part 6 1.05 JSON Variant, as Annex I carries it |
| `parseAnnexINodeId`, `formatAnnexINodeId`, and the `QualifiedName` pair | the `nsu=` canonical forms |
| `annexINamespaceTable`, `OPCUA_CORE_NAMESPACE` | namespace resolution |
| `isAnnexIHeaderLine`, `isAnnexIDocumentHead`, `isAnnexIArchiveHead` | the three sniffers, usable directly |
| `readTar`, `writeTar`, `isTar`, `TarEntry` | the tar layer |
| `ANNEX_I_JSONL_FORMAT`, `ANNEX_I_JSON_FORMAT`, `ANNEX_I_ARCHIVE_FORMAT` | format names, for `nodesetFormatByName` |
| `registerAnnexIJsonlFormat()` and friends | explicit registration; idempotent, and the imports already call them |
| `AnnexINode`, `AnnexIUANodeSet`, `AnnexIReference`, … | the model types |

### The tar layer

`.uanodeset` is a TAR.GZ, and the monorepo has no tar dependency. This should not be the package
that adds one, so `readTar` / `writeTar` are about 150 lines here: they read both the original V7
layout and ustar, and write ustar.

`isTar` recognises an archive by its **header checksum** rather than by a magic string, because
V7 leaves the magic empty and that is what the reference implementation writes. A checksum is the
only structural test that works on both.

Archives are validated against I.3 rather than read optimistically. A manifest naming a file the
archive lacks, and a file the archive holds that the manifest does not name, are both refused:
either one silently changes which nodes get loaded.

## License

MIT
