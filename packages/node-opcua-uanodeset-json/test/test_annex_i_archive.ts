/**
 * The archive form of OPC 10000-6 Annex I.3: a JSON UANodeSet split across files in a TAR.GZ.
 *
 * Two things are being defended. The tar layer is hand-written, so it is tested as a format in
 * its own right rather than only through a nodeset. And the archive rules I.3 states as errors
 * are tested as errors: a manifest that names a file the archive lacks, and a file the archive
 * holds that the manifest does not name, both have to be refused rather than quietly ignored,
 * because either one silently changes which nodes get loaded.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { AddressSpace, generateAddressSpaceRaw, nodesetFormatByName } from "node-opcua-address-space";
import { digestAddressSpace } from "node-opcua-address-space/distHelpers/address_space_digest.js";
import "node-opcua-address-space/distNodeJS/index.js";
import type { NamedNodesetSource, NodesetNodeRecord, NodesetRecord } from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import {
    ANNEX_I_ARCHIVE_FORMAT,
    isTar,
    MANIFEST_NAME,
    readTar,
    recordsToAnnexIArchiveTar,
    type TarEntry,
    writeTar
} from "../source/index.js";

const DEMO_URI = "urn:example:annex-i-archive";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const manifest = {
    Ordered: true,
    Models: [
        {
            ModelUri: DEMO_URI,
            Version: "1.0.0",
            PublicationDate: "2026-01-01T00:00:00Z",
            RequiredModels: [{ ModelUri: "http://opcfoundation.org/UA/", PublicationDate: "2026-01-01T00:00:00Z" }]
        }
    ],
    Files: ["UANodeSet_001.json", "UANodeSet_002.json"]
};

/** two members, so the file order actually matters */
const member1 = {
    Ordered: true,
    HasManifest: true,
    Nodes: {
        ObjectTypes: [
            {
                NodeId: `nsu=${DEMO_URI};i=1000`,
                NodeClass: 8,
                BrowseName: `nsu=${DEMO_URI};WidgetType`,
                IsAbstract: false,
                References: [{ ReferenceTypeId: "i=45", IsForward: false, TargetId: "i=58" }]
            }
        ]
    }
};
const member2 = {
    Ordered: true,
    HasManifest: true,
    Nodes: {
        ObjectTypes: [
            {
                NodeId: `nsu=${DEMO_URI};i=1100`,
                NodeClass: 8,
                BrowseName: `nsu=${DEMO_URI};GadgetType`,
                IsAbstract: false,
                References: [{ ReferenceTypeId: "i=45", IsForward: false, TargetId: `nsu=${DEMO_URI};i=1000` }]
            }
        ]
    }
};

const json = (value: unknown) => encoder.encode(`${JSON.stringify(value, null, 2)}\n`);

function archive(entries: TarEntry[]): Uint8Array {
    return new Uint8Array(zlib.gzipSync(Buffer.from(writeTar(entries))));
}

const wholeArchive = () =>
    archive([
        { name: MANIFEST_NAME, data: json(manifest) },
        { name: "UANodeSet_001.json", data: json(member1) },
        { name: "UANodeSet_002.json", data: json(member2) }
    ]);

function docOf(name: string, gz: Uint8Array) {
    const inflated = new Uint8Array(zlib.gunzipSync(Buffer.from(gz)));
    return {
        name,
        bytes: async () => inflated,
        rawBytes: async () => gz,
        text: async () => decoder.decode(inflated),
        lines: async () => decoder.decode(inflated).split("\n"),
        chunks: async function* () {
            yield gz;
        },
        readHead: async () => decoder.decode(inflated),
        digest: () => undefined
    };
}

async function recordsOf(gz: Uint8Array): Promise<NodesetRecord[]> {
    const format = nodesetFormatByName(ANNEX_I_ARCHIVE_FORMAT);
    should.exist(format);
    const out = [];
    for await (const record of format?.records(docOf("a.uanodeset", gz)) ?? []) {
        out.push(record);
    }
    return out;
}

describe("Annex I archive", () => {
    it("AIA-1 the tar layer round-trips, and recognises itself", () => {
        const entries: TarEntry[] = [
            { name: "manifest.json", data: encoder.encode("{}") },
            // not a multiple of 512, so the padding is exercised
            { name: "UANodeSet_001.json", data: encoder.encode("x".repeat(700)) }
        ];
        const tar = writeTar(entries);
        (tar.length % 512).should.eql(0, "a tar is a whole number of blocks");
        isTar(tar).should.eql(true);
        isTar(encoder.encode("not a tar at all, just some text")).should.eql(false);

        const back = readTar(tar);
        back.length.should.eql(2);
        back[0].name.should.eql("manifest.json");
        decoder.decode(back[1].data).length.should.eql(700, "the padding is not part of the member");
    });

    it("AIA-2 reads a whole archive, in the order the manifest gives", async () => {
        const records = await recordsOf(wholeArchive());
        records.length.should.eql(3, "a header and the two members' nodes");
        records[0].kind.should.eql("header");
        should(nodeAt(records, 1).browseName.name).eql("WidgetType");
        should(nodeAt(records, 2).browseName.name).eql("GadgetType");
    });

    it("AIA-3 refuses an archive the manifest does not describe", async () => {
        // I.3: "Any file in the archive that is not referenced in the manifest is an error."
        const extra = archive([
            { name: MANIFEST_NAME, data: json(manifest) },
            { name: "UANodeSet_001.json", data: json(member1) },
            { name: "UANodeSet_002.json", data: json(member2) },
            { name: "stowaway.json", data: json({ Nodes: {} }) }
        ]);
        await recordsOf(extra).should.be.rejectedWith(/stowaway\.json is in the archive but not in the manifest/);

        // and the other way: a file the manifest names and the archive lacks would drop nodes
        const missing = archive([
            { name: MANIFEST_NAME, data: json(manifest) },
            { name: "UANodeSet_001.json", data: json(member1) }
        ]);
        await recordsOf(missing).should.be.rejectedWith(/names UANodeSet_002\.json, which the archive does not contain/);

        const noManifest = archive([{ name: "UANodeSet_001.json", data: json(member1) }]);
        await recordsOf(noManifest).should.be.rejectedWith(/has no manifest\.json/);
    });

    it("AIA-4 writing is a fixpoint, and splits without dividing a subtree", async () => {
        const records = await recordsOf(wholeArchive());
        const once = recordsToAnnexIArchiveTar(records, { maxNodesPerFile: 1 });
        const twice = recordsToAnnexIArchiveTar(await recordsOf(new Uint8Array(zlib.gzipSync(Buffer.from(once)))), {
            maxNodesPerFile: 1
        });
        Buffer.compare(Buffer.from(once), Buffer.from(twice)).should.eql(0, "write(read(write(read(x)))) is write(read(x))");

        // one node per file was asked for, and there are two nodes
        const written = readTar(once);
        written[0].name.should.eql(MANIFEST_NAME);
        const files = JSON.parse(decoder.decode(written[0].data)).Files;
        files.length.should.eql(2, "the two types are split across two members");
        written.length.should.eql(3, "the manifest and the two members");
        // the members carry no Models: I.3 says the manifest specifies them
        const first = JSON.parse(decoder.decode(written[1].data));
        first.HasManifest.should.eql(true);
        should.not.exist(first.Models);
    });

    it("AIA-5 builds the address space the equivalent NodeSet2 XML builds", async () => {
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
  <UAObjectType NodeId="ns=1;i=1100" BrowseName="1:GadgetType" IsAbstract="false">
    <References><Reference ReferenceType="i=45" IsForward="false">ns=1;i=1000</Reference></References>
  </UAObjectType>
</UANodeSet>`;
        const core = fs.readFileSync(nodesets.standard, "utf8");
        const build = async (second: NamedNodesetSource) => {
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
        const gz = wholeArchive();
        const fromXml = await build({ name: "d.xml", source: equivalentXml });
        const fromArchive = await build({ name: "d.uanodeset", source: () => [gz] });
        fromArchive.hash.should.eql(fromXml.hash);
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
