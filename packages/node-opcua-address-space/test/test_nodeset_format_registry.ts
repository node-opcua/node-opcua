/**
 * A nodeset document is recognised by what it says, not by what it is called.
 *
 * The loader used to know exactly two serialisations and decide between them on one byte: gzip or
 * `{` meant "one of our images", anything else meant XML. That was wrong in a way nothing caught,
 * because nothing else gzipped was ever put in front of it. Any other compressed nodeset -- a
 * foreign JSON Lines file, a tar archive -- was not rejected as unreadable. It was claimed as an
 * image and then failed inside a codec that had no business seeing it.
 *
 * These tests pin the registry that replaced that: that a format can be added from outside, that
 * it is chosen on the content of the document, and above all that a gzip stream which is not one
 * of our images is no longer mistaken for one.
 */
import zlib from "node:zlib";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import {
    AddressSpace,
    findNodesetFormat,
    generateAddressSpaceRaw,
    isNdjsonHeaderLine,
    NDJSON_IMAGE_FORMAT,
    NODESET2_XML_FORMAT,
    type NodesetDocument,
    type NodesetFormat,
    type NodesetHead,
    type NodesetModelInfo,
    type NodesetRecord,
    nodesetFormatByName,
    nodesetFormats,
    registerNodesetFormat
} from "../dist/api/index.js";
import "../distNodeJS/index.js";

const LF = "\n";

/** the head a sniffer would be shown for this text, as the reader builds one */
function headOf(text: string, gzip = false): NodesetHead {
    const newline = text.indexOf(LF);
    return {
        name: "test",
        text,
        gzip,
        firstLine: newline < 0 ? text : text.slice(0, newline)
    };
}

const OUR_HEADER =
    '{"kind":"header","schema":3,"addressSpaceVersion":"x","createdAt":"2026-01-01T00:00:00.000Z",' +
    '"namespaceUris":[],"models":[],"aliases":{}}';

/** the first line of a nodeset written the way the OPC Foundation's UA-NodeSetTool writes one */
const THEIR_HEADER =
    '{"SPDX":{"CopyrightText":"Copyright (C) 2026","LicenceId":"MIT"},"Ordered":true,' +
    '"Models":[{"ModelUri":"urn:example:demo","ModelVersion":"1.0.0","Version":"1.0.0","RequiredModels":[]}]}';

const MINIMAL_XML = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris><Uri>urn:example:registry</Uri></NamespaceUris>
  <Models><Model ModelUri="urn:example:registry" Version="1.0.0" PublicationDate="2026-01-01T00:00:00Z"/></Models>
</UANodeSet>`;

describe("NodesetFormat registry", () => {
    it("NFR-1 recognises NodeSet2 XML as the fallback format", () => {
        const format = findNodesetFormat(headOf(MINIMAL_XML));
        should.exist(format);
        format?.name.should.eql(NODESET2_XML_FORMAT);
    });

    it("NFR-2 recognises one of our own images by its header record, not by its first byte", () => {
        findNodesetFormat(headOf(OUR_HEADER))?.name.should.eql(NDJSON_IMAGE_FORMAT);
        isNdjsonHeaderLine(OUR_HEADER).should.eql(true);
    });

    it("NFR-3 does not claim a foreign JSON Lines nodeset as one of our images", () => {
        // the bug this registry exists to fix: their document also begins with a brace, and the
        // old sniffer looked no further than that
        isNdjsonHeaderLine(THEIR_HEADER).should.eql(false);
        findNodesetFormat(headOf(THEIR_HEADER))?.name.should.not.eql(NDJSON_IMAGE_FORMAT);
    });

    it("NFR-4 does not claim an arbitrary gzip stream as one of our images", () => {
        // a .jsonl.gz or a .uanodeset tar.gz inflates to something that is not ours; a sniffer is
        // shown the *inflated* head, so the gzip wrapper decides nothing on its own
        findNodesetFormat(headOf(THEIR_HEADER, true))?.name.should.not.eql(NDJSON_IMAGE_FORMAT);

        const tarHeader = `${"member.json".padEnd(257, "\0")}ustar\0`;
        findNodesetFormat(headOf(tarHeader, true))?.name.should.not.eql(NDJSON_IMAGE_FORMAT);
    });

    it("NFR-5 lets a format be registered from outside, and taken away again", async () => {
        const seen: string[] = [];
        const fakeFormat: NodesetFormat = {
            name: "test-fake",
            extensions: [".fake"],
            priority: 500,
            sniff: (head: NodesetHead) => head.firstLine.startsWith("FAKE"),
            async readModels(_document: NodesetDocument): Promise<NodesetModelInfo> {
                return { namespaceUris: [], models: [] };
            },
            // biome-ignore lint/correctness/useYield: a format that produces no records
            async *records(document: NodesetDocument): AsyncGenerator<NodesetRecord> {
                seen.push(await document.text());
            }
        };

        should.not.exist(nodesetFormatByName("test-fake"));
        const unregister = registerNodesetFormat(fakeFormat);
        try {
            should.exist(nodesetFormatByName("test-fake"));
            nodesetFormats()[0].name.should.eql("test-fake", "the strongest claim is asked first");
            findNodesetFormat(headOf("FAKE nodeset"))?.name.should.eql("test-fake");
        } finally {
            unregister();
        }
        should.not.exist(nodesetFormatByName("test-fake"));
        // with the format gone the document falls back to XML rather than staying claimed
        findNodesetFormat(headOf("FAKE nodeset"))?.name.should.eql(NODESET2_XML_FORMAT);
        seen.length.should.eql(0);
    });

    it("NFR-6 loads a document through a format registered from outside", async () => {
        const MARKER = "#!nodeset-with-a-preamble";
        const preambledXml = MARKER + LF + MINIMAL_XML;
        const xmlFormat = nodesetFormatByName(NODESET2_XML_FORMAT) as NodesetFormat;

        // NodeSet2 XML behind one line of preamble. Contrived on purpose: it shares no bytes of
        // its sniff with either built-in, so if the loader reads it at all, that can only be
        // because dispatch went through the registry
        const preambled: NodesetFormat = {
            name: "test-preamble",
            priority: 900,
            sniff: (head: NodesetHead) => head.firstLine === MARKER,
            readModels: (document) => xmlFormat.readModels(withoutFirstLine(document)),
            records: (document, options) => xmlFormat.records(withoutFirstLine(document), options)
        };

        const unregister = registerNodesetFormat(preambled);
        const addressSpace = AddressSpace.create();
        try {
            findNodesetFormat(headOf(preambledXml))?.name.should.eql("test-preamble");
            await generateAddressSpaceRaw(addressSpace, [{ name: "preambled", source: preambledXml }], {
                imageStore: false
            });
            addressSpace.getNamespaceIndex("urn:example:registry").should.be.greaterThan(0);
        } finally {
            addressSpace.dispose();
            unregister();
        }
    });

    it("NFR-7 a gzipped NodeSet2 XML document is not taken for an image", async () => {
        const gz = zlib.gzipSync(Buffer.from(MINIMAL_XML, "utf8"));
        // the caller inflates, as the documented browser and Node recipes do; what matters here is
        // that nothing along the way concluded "gzip, therefore one of ours"
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpaceRaw(
                addressSpace,
                [{ name: "gzipped.xml.gz", source: () => [new Uint8Array(zlib.gunzipSync(gz))] }],
                { imageStore: false }
            );
            addressSpace.getNamespaceIndex("urn:example:registry").should.be.greaterThan(0);
        } finally {
            addressSpace.dispose();
        }
    });
});

/**
 * the same document with its first line taken off.
 *
 * A format that wraps another owes it a document it can actually read, so the preamble has to be
 * gone from every accessor and not only from the convenient one.
 */
function withoutFirstLine(document: NodesetDocument): NodesetDocument {
    const rest = async () => (await document.lines()).slice(1).join(LF);
    return {
        ...document,
        lines: async () => (await document.lines()).slice(1),
        text: rest,
        bytes: async () => new TextEncoder().encode(await rest()),
        readHead: async () => await rest(),
        chunks: async function* () {
            yield await rest();
        }
    };
}
