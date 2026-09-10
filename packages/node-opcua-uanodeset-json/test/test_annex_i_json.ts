/**
 * Reading and writing the whole-document form of OPC 10000-6 Annex I.
 *
 * Two claims are worth defending here, and neither is "it parses".
 *
 * The first is that the document form and the line form describe the same nodeset, so a reader of
 * one is a reader of the other with the shape undone: the eight NodeClass containers flattened,
 * and each Node's children emitted depth first behind it.
 *
 * The second is that writing is a fixpoint. `write(read(x))` and `write(read(write(read(x))))`
 * have to be byte-identical, or the format has a degree of freedom the encoder is exercising at
 * random and no two tools will ever agree on a file. Note what that does *not* prove: a loss the
 * reader and the writer share is invisible to it, which is why the equivalence against NodeSet2
 * XML below matters more than the fixpoint does.
 */
import fs from "node:fs";
import { AddressSpace, generateAddressSpaceRaw, nodesetFormatByName } from "node-opcua-address-space";
import { digestAddressSpace } from "node-opcua-address-space/distHelpers/address_space_digest.js";
import "node-opcua-address-space/distNodeJS/index.js";
import type { NodesetNodeRecord, NodesetRecord } from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { ANNEX_I_JSON_FORMAT, ANNEX_I_JSONL_FORMAT, isAnnexIDocumentHead, recordsToAnnexIJson } from "../source/index.js";

const DEMO_URI = "urn:example:annex-i-json";

/** an ObjectType with one nested child, which is what exercises the ChildList in both directions */
const document = {
    Ordered: true,
    Models: [
        {
            ModelUri: DEMO_URI,
            Version: "1.0.0",
            PublicationDate: "2026-01-01T00:00:00Z",
            RequiredModels: [{ ModelUri: "http://opcfoundation.org/UA/", PublicationDate: "2026-01-01T00:00:00Z" }]
        }
    ],
    Nodes: {
        ObjectTypes: [
            {
                NodeId: `nsu=${DEMO_URI};i=1000`,
                NodeClass: 8,
                BrowseName: `nsu=${DEMO_URI};WidgetType`,
                IsAbstract: false,
                References: [{ ReferenceTypeId: "i=45", IsForward: false, TargetId: "i=58" }],
                Children: {
                    Variables: [
                        {
                            NodeId: `nsu=${DEMO_URI};i=1001`,
                            NodeClass: 2,
                            BrowseName: `nsu=${DEMO_URI};Serial`,
                            ParentId: `nsu=${DEMO_URI};i=1000`,
                            TypeId: "i=63",
                            ModellingRuleId: "i=78",
                            DataType: "i=12",
                            References: [{ ReferenceTypeId: "i=46", IsForward: false, TargetId: `nsu=${DEMO_URI};i=1000` }]
                        }
                    ]
                }
            }
        ]
    }
};

const text = `${JSON.stringify(document, null, 2)}\n`;

function docOf(name: string, body: string) {
    return {
        name,
        text: async () => body,
        lines: async () => body.split("\n"),
        bytes: async () => new TextEncoder().encode(body),
        rawBytes: async () => new TextEncoder().encode(body),
        chunks: async function* () {
            yield body;
        },
        readHead: async () => body,
        digest: () => undefined
    };
}

async function recordsOf(body: string): Promise<NodesetRecord[]> {
    const format = nodesetFormatByName(ANNEX_I_JSON_FORMAT);
    should.exist(format);
    const out = [];
    for await (const record of format?.records(docOf("d.json", body)) ?? []) {
        out.push(record);
    }
    return out;
}

describe("Annex I JSON document", () => {
    it("AIJD-1 tells the document form from the line form by its Nodes field", () => {
        // I.4: the first line of a .jsonl is "the UANodeSet without the Nodes field"
        const head = { name: "t", text, firstLine: "{", gzip: false };
        isAnnexIDocumentHead(head).should.eql(true);

        const lineForm = '{"Ordered":true,"Models":[{"ModelUri":"urn:x"}]}';
        isAnnexIDocumentHead({ name: "t", text: lineForm, firstLine: lineForm, gzip: false }).should.eql(false);

        const image = '{"kind":"header","schema":3,"Nodes":{},"Models":[]}';
        isAnnexIDocumentHead({ name: "t", text: image, firstLine: image, gzip: false }).should.eql(false);

        ANNEX_I_JSON_FORMAT.should.not.eql(ANNEX_I_JSONL_FORMAT);
    });

    it("AIJD-2 flattens the containers and the nested children", async () => {
        const records = await recordsOf(text);
        records.length.should.eql(3, "a header, the ObjectType, and its nested child");
        records[0].kind.should.eql("header");
        // the child follows its parent, which is what the line form requires of the same nodes
        should(nodeAt(records, 1).browseName.name).eql("WidgetType");
        should(nodeAt(records, 2).browseName.name).eql("Serial");
        should(nodeAt(records, 2).parentNodeId?.toString()).eql("ns=1;i=1000");
    });

    it("AIJD-3 writing is a fixpoint, byte for byte", async () => {
        const once = recordsToAnnexIJson(await recordsOf(text));
        const twice = recordsToAnnexIJson(await recordsOf(once));
        twice.should.eql(once, "write(read(write(read(x)))) is write(read(x))");

        // and the nodes survive the trip rather than the bytes merely agreeing
        const back = await recordsOf(once);
        back.length.should.eql(3);
        should(nodeAt(back, 2).browseName.name).eql("Serial");
    });

    it("AIJD-4 what we write re-nests the children we flattened", async () => {
        const written = JSON.parse(recordsToAnnexIJson(await recordsOf(text)));
        should.exist(written.Nodes.ObjectTypes);
        written.Nodes.ObjectTypes.length.should.eql(1);
        const parent = written.Nodes.ObjectTypes[0];
        should.exist(parent.Children?.Variables, "the child is written inside its parent again");
        parent.Children.Variables.length.should.eql(1);
        // TypeId and ModellingRuleId go back to being fields, not references
        parent.Children.Variables[0].TypeId.should.eql("i=63");
        parent.Children.Variables[0].ModellingRuleId.should.eql("i=78");
        // and the parent does not repeat the edge that ParentId implies
        const forwardToChild = (parent.References ?? []).find((r: { TargetId?: string }) => r.TargetId?.endsWith("i=1001"));
        should.not.exist(forwardToChild);
    });

    it("AIJD-5 builds the address space the equivalent NodeSet2 XML builds", async () => {
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
  <UAVariable NodeId="ns=1;i=1001" BrowseName="1:Serial" ParentNodeId="ns=1;i=1000" DataType="i=12">
    <References>
      <Reference ReferenceType="i=40">i=63</Reference>
      <Reference ReferenceType="i=37">i=78</Reference>
      <Reference ReferenceType="i=46" IsForward="false">ns=1;i=1000</Reference>
    </References>
  </UAVariable>
</UANodeSet>`;

        const core = fs.readFileSync(nodesets.standard, "utf8");
        const build = async (second: { name: string; source: string }) => {
            const addressSpace = AddressSpace.create();
            try {
                await generateAddressSpaceRaw(addressSpace, [{ name: "core", source: core }, second], {
                    imageStore: false
                });
                return digestAddressSpace(addressSpace);
            } finally {
                addressSpace.dispose();
            }
        };
        const fromXml = await build({ name: "d.xml", source: equivalentXml });
        const fromJson = await build({ name: "d.json", source: text });
        const fromOurs = await build({ name: "ours.json", source: recordsToAnnexIJson(await recordsOf(text)) });

        fromJson.hash.should.eql(fromXml.hash, "reading the document form gives the XML address space");
        fromOurs.hash.should.eql(fromXml.hash, "and so does reading what we wrote");
    });
});

/**
 * the record at that position, as a node.
 *
 * A record stream is a header followed by nodes, so indexing it gives the union of the two and
 * the fields a test wants are on only one side of it. Narrowing here says which the test meant,
 * and fails loudly rather than reading undefined if the stream is ever shaped differently.
 */
function nodeAt(records: NodesetRecord[], index: number): NodesetNodeRecord {
    const record = records[index];
    if (record?.kind !== "node") {
        throw new Error(`record ${index} is ${record?.kind ?? "absent"}, not a node`);
    }
    return record;
}
