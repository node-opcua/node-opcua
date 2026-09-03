/**
 * A precompiled image is the records of a document as JSON Lines, gzip-compressed. Writing one
 * consumes records, reading one produces them; the address space built from an image must be the
 * one built from the XML, for every value type the codec carries.
 */
import fs from "node:fs";
import { coerceInt64, coerceUInt64, DataType } from "node-opcua-basic-types";
import { Range } from "node-opcua-data-access";
import { QualifiedName } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { ExpandedNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { Argument, EnumValueType, EUInformation } from "node-opcua-types";
import { VariantArrayType, type VariantOptions } from "node-opcua-variant";
import should from "should";
import {
    AddressSpace,
    decodeValue,
    encodeValue,
    imageNodesetRecords,
    isNodesetImage,
    NodesetImageError,
    NodesetImageWriter,
    type NodesetRecord,
    readNodesetImageInfo,
    XmlExtensionObjectFragment,
    xmlNodesetRecords
} from "../dist/api/index.js";
import { NodeSetLoader } from "../dist/api/loader/load_nodeset2.js";
import { adjustNamespaceArray } from "../dist/impl/nodeset_tools/adjust_namespace_array.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { digestAddressSpace } from "../test_helpers/address_space_digest.js";

async function* fileChunks(file: string): AsyncGenerator<string> {
    for await (const chunk of fs.createReadStream(file, { encoding: "utf8", highWaterMark: 256 * 1024 })) {
        yield chunk as string;
    }
}

/** the image of a NodeSet2 file, and the records it was written from */
const createdAt = new Date("2026-09-02T00:00:00Z");
async function imageOf(file: string, digest = "test"): Promise<{ image: Uint8Array; records: NodesetRecord[]; text: string }> {
    const writer = new NodesetImageWriter({ addressSpaceVersion: "test", createdAt });
    const records: NodesetRecord[] = [];
    for await (const record of xmlNodesetRecords(fileChunks(file))) {
        writer.apply(record);
        records.push(record);
    }
    return { image: await writer.finish(digest), records, text: writer.text(digest) };
}

async function loadImages(images: Uint8Array[]): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    const loader = new NodeSetLoader(addressSpace, {});
    for (const image of images) {
        await loader.addRecords(imageNodesetRecords(image));
    }
    await loader.terminate();
    adjustNamespaceArray(addressSpace);
    return addressSpace;
}

describe("Nodeset image", function (this: Mocha.Suite) {
    this.timeout(120000);

    describe("the value codec", () => {
        const roundTrip = (options: VariantOptions) => decodeValue(JSON.parse(JSON.stringify(encodeValue(options))));

        it("keeps every scalar type the reader produces", () => {
            const date = new Date("2024-05-06T07:08:09.123Z");
            (date as Date & { picoseconds?: number }).picoseconds = 456000;
            const cases: VariantOptions[] = [
                { dataType: DataType.Boolean, value: true },
                { dataType: DataType.Int32, value: -5 },
                { dataType: DataType.Double, value: 1.25 },
                { dataType: DataType.Double, value: Number.NaN },
                { dataType: DataType.Float, value: Number.NEGATIVE_INFINITY },
                { dataType: DataType.String, value: "héllo" },
                { dataType: DataType.Guid, value: "72962B91-FA75-4AE6-8D28-B404DC7DAF63" },
                { dataType: DataType.ByteString, value: Buffer.from([1, 2, 255]) },
                { dataType: DataType.DateTime, value: date },
                { dataType: DataType.Int64, value: coerceInt64("-1234567890123") },
                { dataType: DataType.UInt64, value: coerceUInt64("18446744073709551615") },
                { dataType: DataType.NodeId, value: new NodeId(NodeIdType.STRING, "Tag", 3) },
                { dataType: DataType.NodeId, value: new NodeId(NodeIdType.BYTESTRING, Buffer.from("id"), 1) },
                { dataType: DataType.ExpandedNodeId, value: new ExpandedNodeId(NodeIdType.NUMERIC, 7, 2, "urn:x", 4) },
                { dataType: DataType.QualifiedName, value: new QualifiedName({ namespaceIndex: 2, name: "Q" }) },
                { dataType: DataType.LocalizedText, value: { locale: "en", text: "T" } },
                { dataType: DataType.StatusCode, value: StatusCodes.BadInternalError },
                { dataType: DataType.XmlElement, value: "<a/>" }
            ];
            for (const options of cases) {
                const back = roundTrip(options);
                should(encodeValue(back)).eql(encodeValue(options), DataType[options.dataType as DataType]);
                should(back.dataType).eql(options.dataType);
            }
            const backDate = roundTrip({ dataType: DataType.DateTime, value: date }).value as Date & { picoseconds?: number };
            should(backDate.getTime()).eql(date.getTime());
            should(backDate.picoseconds).eql(456000);
            should(roundTrip({ dataType: DataType.Double, value: Number.NaN }).value).be.NaN();
            should(roundTrip({ dataType: DataType.ByteString, value: Buffer.from([1, 2, 255]) }).value).eql(
                Buffer.from([1, 2, 255])
            );
            const nodeId = roundTrip({ dataType: DataType.NodeId, value: new NodeId(NodeIdType.BYTESTRING, Buffer.from("id"), 1) })
                .value as NodeId;
            should(nodeId.identifierType).eql(NodeIdType.BYTESTRING);
            should(nodeId.toString()).eql("ns=1;b=aWQ=");
        });

        it("keeps arrays and matrices, and null values", () => {
            const array = roundTrip({
                dataType: DataType.NodeId,
                arrayType: VariantArrayType.Array,
                value: [new NodeId(NodeIdType.NUMERIC, 1, 0), null]
            });
            should(array.arrayType).eql(VariantArrayType.Array);
            should((array.value as unknown[])[0]).be.instanceOf(NodeId);
            should((array.value as unknown[])[1]).eql(null);
            const matrix = roundTrip({
                dataType: DataType.Double,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 2],
                value: [1, 2, 3, 4]
            });
            should(matrix.dimensions).eql([2, 2]);
            should(matrix.value).eql([1, 2, 3, 4]);
            should(roundTrip({ dataType: DataType.String, arrayType: VariantArrayType.Array, value: null }).value).eql(null);
        });

        it("keeps the four extension objects the reader decodes, and XML fragments for the rest", () => {
            const argument = new Argument({
                name: "x",
                dataType: new NodeId(NodeIdType.NUMERIC, 11, 0),
                valueRank: -1,
                description: { text: "d" }
            });
            const backArgument = roundTrip({ dataType: DataType.ExtensionObject, value: argument }).value as Argument;
            should(backArgument).be.instanceOf(Argument);
            should(backArgument.dataType.toString()).eql("ns=0;i=11");
            should(backArgument.description.text).eql("d");
            const eu = new EUInformation({ namespaceUri: "urn:u", unitId: 5, displayName: { text: "m" } });
            should((roundTrip({ dataType: DataType.ExtensionObject, value: eu }).value as EUInformation).unitId).eql(5);
            should(
                (roundTrip({ dataType: DataType.ExtensionObject, value: new Range({ low: -1, high: 2 }) }).value as Range).high
            ).eql(2);
            const enumValue = new EnumValueType({ value: coerceInt64(3), displayName: { text: "three" } });
            should((roundTrip({ dataType: DataType.ExtensionObject, value: enumValue }).value as EnumValueType).value).eql(
                coerceInt64(3)
            );
            const fragment = new XmlExtensionObjectFragment(
                new NodeId(NodeIdType.NUMERIC, 3001, 1),
                "<MyStruct><A>1</A></MyStruct>"
            );
            const list = roundTrip({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [fragment, argument, null]
            });
            const [f, a, n] = list.value as unknown[];
            should(f).be.instanceOf(XmlExtensionObjectFragment);
            should((f as XmlExtensionObjectFragment).bodyXML).eql("<MyStruct><A>1</A></MyStruct>");
            should(a).be.instanceOf(Argument);
            should(n).eql(null);
        });

        it("refuses what an image cannot carry", () => {
            should(() => encodeValue({ dataType: DataType.DataValue, value: { statusCode: StatusCodes.Good } })).throw(
                NodesetImageError
            );
        });
    });

    describe("writing and reading", () => {
        let image: Uint8Array;
        let records: NodesetRecord[];
        let text: string;
        before(async () => {
            ({ image, records, text } = await imageOf(nodesets.standard, "digest-of-standard"));
        });

        it("is told from XML by its first bytes, and carries the header and the trailer", async () => {
            should(isNodesetImage(image)).eql(true);
            should(isNodesetImage(new TextEncoder().encode("<?xml"))).eql(false);
            should(image.length).be.lessThan(400 * 1024);
            const info = await readNodesetImageInfo(image);
            should(info.header.schema).eql(2);
            should(info.header.addressSpaceVersion).eql("test");
            should(info.header.models[0].modelUri).eql("http://opcfoundation.org/UA/");
            should(info.trailer?.nodes).eql(records.length - 1);
            should(info.trailer?.sourceDigest).eql("digest-of-standard");
        });

        it("reads back the records it was written from", async () => {
            const back: NodesetRecord[] = [];
            for await (const record of imageNodesetRecords(image, { expectedDigest: "digest-of-standard" })) {
                back.push(record);
            }
            should(back.length).eql(records.length);
            // written again, the records read back give the same image text, line for line
            const again = new NodesetImageWriter({ addressSpaceVersion: "test", createdAt });
            for (const record of back) again.apply(record);
            const lines = text.split("\n");
            const linesAgain = again.text("digest-of-standard").split("\n");
            should(linesAgain.length).eql(lines.length);
            for (let i = 0; i < lines.length; i++) {
                should(linesAgain[i]).eql(lines[i], `line ${i}`);
            }
        });

        it("rejects a truncated image, a foreign one, and one of another schema", async () => {
            const collect = async (bytes: Uint8Array, expectedDigest?: string) => {
                const out: NodesetRecord[] = [];
                for await (const record of imageNodesetRecords(bytes, { expectedDigest })) out.push(record);
                return out;
            };
            await collect(image.subarray(0, image.length - 2000)).should.be.rejectedWith(NodesetImageError);
            await collect(image, "some-other-digest").should.be.rejectedWith(/digest/);
            const writer = new NodesetImageWriter();
            writer.apply(records[0]);
            const text = writer.text("x").replace('"schema":2', '"schema":999');
            const gz = new Uint8Array(
                await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()
            );
            await collect(gz).should.be.rejectedWith(/schema 999/);
        });

        it("builds the same address space from the image as from the XML", async () => {
            const fromXml = AddressSpace.create();
            await generateAddressSpace(fromXml, [nodesets.standard]);
            const expected = digestAddressSpace(fromXml);
            fromXml.dispose();

            const fromImage = await loadImages([image]);
            should(digestAddressSpace(fromImage)).eql(expected);
            fromImage.dispose();
        });

        it("chains images the way it chains files (standard then DI)", async () => {
            const di = await imageOf(nodesets.di);
            const fromXml = AddressSpace.create();
            await generateAddressSpace(fromXml, [nodesets.standard, nodesets.di]);
            const expected = digestAddressSpace(fromXml);
            fromXml.dispose();

            const fromImage = await loadImages([image, di.image]);
            should(digestAddressSpace(fromImage)).eql(expected);
            fromImage.dispose();
        });
    });
});
