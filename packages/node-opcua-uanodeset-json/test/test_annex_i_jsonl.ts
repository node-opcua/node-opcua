/**
 * Reading OPC 10000-6 Annex I.4, a JSON UANodeSet written one object per line.
 *
 * The claim these tests defend is the only one that matters for a serialisation: an address space
 * built from an Annex I document is the address space built from the NodeSet2 XML it came from.
 * Node counts agreeing is not that claim; `digestAddressSpace` hashes every node's id, browse
 * name, class, reference count and, for variables, status code and value, so two loads that agree
 * on it agree on their contents.
 */
import fs from "node:fs";
import type { NodesetNodeRecord, NodesetReferenceRecord, NodesetSource } from "node-opcua-address-space";
import { AddressSpace, generateAddressSpaceRaw } from "node-opcua-address-space";
import { digestAddressSpace } from "node-opcua-address-space/distHelpers/address_space_digest.js";
import { nodesets } from "node-opcua-nodesets";
import "node-opcua-address-space/distNodeJS/index.js";
import { findNodesetFormat, nodesetFormatByName } from "node-opcua-address-space";
import should from "should";
import { ANNEX_I_JSONL_FORMAT, annexINamespaceTable, isAnnexIHeaderLine, parseAnnexINodeId } from "../source/index.js";

const LF = "\n";

const DEMO_URI = "urn:example:annex-i";

const header = JSON.stringify({
    SPDX: { CopyrightText: "Copyright (C) 2026", LicenceId: "MIT" },
    Ordered: true,
    Models: [
        {
            ModelUri: DEMO_URI,
            Version: "1.0.0",
            PublicationDate: "2026-01-01T00:00:00Z",
            RequiredModels: [{ ModelUri: "http://opcfoundation.org/UA/", PublicationDate: "2026-01-01T00:00:00Z" }]
        }
    ]
});

/** an ObjectType, and an Object typed by it that states its TypeId as a field rather than an edge */
const nodes = [
    JSON.stringify({
        NodeId: `nsu=${DEMO_URI};i=1000`,
        NodeClass: 8,
        BrowseName: `nsu=${DEMO_URI};WidgetType`,
        IsAbstract: false,
        References: [{ ReferenceTypeId: "i=45", IsForward: false, TargetId: "i=58" }]
    }),
    JSON.stringify({
        NodeId: `nsu=${DEMO_URI};i=2000`,
        NodeClass: 1,
        BrowseName: `nsu=${DEMO_URI};Widget`,
        TypeId: `nsu=${DEMO_URI};i=1000`,
        References: [{ ReferenceTypeId: "i=35", IsForward: false, TargetId: "i=85" }]
    })
];

const document = [header, ...nodes].join(LF) + LF;

/** the same model as NodeSet2 XML, stating as References what Annex I states as fields */
const equivalentXml = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris><Uri>${DEMO_URI}</Uri></NamespaceUris>
  <Models>
    <Model ModelUri="${DEMO_URI}" Version="1.0.0" PublicationDate="2026-01-01T00:00:00Z">
      <RequiredModel ModelUri="http://opcfoundation.org/UA/" PublicationDate="2026-01-01T00:00:00Z"/>
    </Model>
  </Models>
  <UAObjectType NodeId="ns=1;i=1000" BrowseName="1:WidgetType" IsAbstract="false">
    <References><Reference ReferenceType="i=45" IsForward="false">i=58</Reference></References>
  </UAObjectType>
  <UAObject NodeId="ns=1;i=2000" BrowseName="1:Widget">
    <References>
      <Reference ReferenceType="i=40">ns=1;i=1000</Reference>
      <Reference ReferenceType="i=35" IsForward="false">i=85</Reference>
    </References>
  </UAObject>
</UANodeSet>`;

describe("Annex I JSONL", () => {
    it("AIJ-1 recognises a header line, and does not claim one of the loader's own images", () => {
        isAnnexIHeaderLine(header).should.eql(true);
        should(findNodesetFormat({ name: "t", text: document, firstLine: header, gzip: false })?.name).eql(ANNEX_I_JSONL_FORMAT);

        const image = '{"kind":"header","schema":3,"namespaceUris":[],"models":[],"aliases":{}}';
        isAnnexIHeaderLine(image).should.eql(false);
    });

    it("AIJ-2 derives the namespace table from the models, with the UA namespace at 0", () => {
        // I.1 gives NodeIds no namespace table of their own, so a reader has to rebuild the order
        const table = annexINamespaceTable([
            { ModelUri: DEMO_URI, RequiredModels: [{ ModelUri: "http://opcfoundation.org/UA/" }] }
        ]);
        table.should.eql(["http://opcfoundation.org/UA/", DEMO_URI]);
        parseAnnexINodeId("i=58", table).toString().should.eql("ns=0;i=58");
        parseAnnexINodeId(`nsu=${DEMO_URI};i=1000`, table).toString().should.eql("ns=1;i=1000");
        // a string identifier may contain semicolons; the namespace uri may not
        parseAnnexINodeId(`nsu=${DEMO_URI};s=a;b`, table).value.should.eql("a;b");
    });

    it("AIJ-3 puts back the references the annex states as fields", async () => {
        const format = nodesetFormatByName(ANNEX_I_JSONL_FORMAT);
        should.exist(format);
        const doc = {
            name: "demo.jsonl",
            lines: async () => document.split(LF),
            text: async () => document,
            bytes: async () => new TextEncoder().encode(document),
            rawBytes: async () => new TextEncoder().encode(document),
            chunks: async function* () {
                yield document;
            },
            readHead: async () => document,
            digest: () => undefined
        };
        const records = [];
        for await (const record of format?.records(doc) ?? []) {
            records.push(record);
        }
        records.length.should.eql(3, "a header and two nodes");

        const widget = records.find(
            (record): record is NodesetNodeRecord => record.kind === "node" && record.browseName.name === "Widget"
        );
        should.exist(widget);
        // TypeId is not written as a reference by the annex; the address space still wants one
        const hasTypeDefinition = (widget as NodesetNodeRecord).references.find(
            (reference: NodesetReferenceRecord) => reference.referenceType.value === 40
        );
        should.exist(hasTypeDefinition, "the HasTypeDefinition reference is reconstructed from TypeId");
        (hasTypeDefinition as NodesetReferenceRecord).isForward.should.eql(true);
        (hasTypeDefinition as NodesetReferenceRecord).nodeId.toString().should.eql("ns=1;i=1000");
    });

    it("AIJ-4 builds the address space the equivalent NodeSet2 XML builds", async () => {
        const build = async (second: NodesetSource) => {
            const addressSpace = AddressSpace.create();
            try {
                await generateAddressSpaceRaw(addressSpace, [{ name: "core", source: coreXml() }, second], {
                    imageStore: false
                });
                return digestAddressSpace(addressSpace);
            } finally {
                addressSpace.dispose();
            }
        };
        const fromXml = await build({ name: "demo.xml", source: equivalentXml });
        const fromJsonl = await build({ name: "demo.jsonl", source: document });

        fromJsonl.nodes.should.eql(fromXml.nodes);
        fromJsonl.references.should.eql(fromXml.references);
        fromJsonl.hash.should.eql(fromXml.hash, "the two documents describe the same address space");
    });
});

/** the standard nodeset, which everything else is written against */
function coreXml(): string {
    // the path still comes from the catalogue rather than being assumed, so this keeps
    // working if the nodesets move; it just no longer needs to be resolved lazily
    return fs.readFileSync(nodesets.standard, "utf8");
}
