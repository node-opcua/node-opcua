/**
 * The Node.js generateAddressSpace replays the image that sits next to a NodeSet2 file when its
 * digest is the XML's, and falls back to the XML otherwise, silently; imageStore: false switches
 * the sibling images off. The catalog ships an image for every nodeset.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesetCatalog, nodesetImages, nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, readNodesetImageInfo } from "../dist/api/index.js";
import { generateAddressSpace, nodesetFileToImage, siblingImageFileOf } from "../distNodeJS/index.js";
import { type AddressSpaceDigest, digestAddressSpace } from "../test_helpers/address_space_digest.js";
import { get_mini_nodeset_filename } from "../test_helpers/get_mini_address_space.js";

async function load(file: string, imageStore?: false): Promise<AddressSpaceDigest> {
    const addressSpace = AddressSpace.create();
    try {
        await generateAddressSpace(addressSpace, [file], imageStore === false ? { imageStore: false } : {});
        return digestAddressSpace(addressSpace);
    } finally {
        addressSpace.dispose();
    }
}

/**
 * an image whose header and trailer claim the length and the digest of `xmlFile` while its content
 * is `image`'s: what only a replay of the sibling image can produce
 */
function imageClaiming(image: Uint8Array, xmlFile: string): Uint8Array {
    const digest = createHash("sha256").update(fs.readFileSync(xmlFile)).digest("hex");
    const lines = zlib.gunzipSync(image).toString("utf8").split("\n");
    const header = JSON.parse(lines[0]);
    header.sourceLength = fs.statSync(xmlFile).size;
    lines[0] = JSON.stringify(header);
    const trailerIndex = lines.length - 2; // the text ends with a newline
    const trailer = JSON.parse(lines[trailerIndex]);
    trailer.sourceDigest = digest;
    lines[trailerIndex] = JSON.stringify(trailer);
    return new Uint8Array(zlib.gzipSync(lines.join("\n")));
}

describe("Sibling images", function (this: Mocha.Suite) {
    this.timeout(120000);

    let directory: string;
    let xmlFile: string;
    let reference: AddressSpaceDigest;
    let edited: AddressSpaceDigest;
    let editedXml: string;

    before(async () => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), "sibling-images-"));
        xmlFile = path.join(directory, "mini.NodeSet2.xml");
        fs.copyFileSync(get_mini_nodeset_filename(), xmlFile);
        reference = await load(xmlFile, false);
        // a variant of the document with one node more: tells an image apart from the XML
        const text = fs.readFileSync(xmlFile, "utf8");
        const added = text.replace(
            "</UANodeSet>",
            '<UAObject NodeId="i=999999" BrowseName="AddedForTheTest"><References><Reference ReferenceType="HasTypeDefinition">i=58</Reference><Reference ReferenceType="Organizes" IsForward="false">i=85</Reference></References></UAObject></UANodeSet>'
        );
        should(added.length).be.greaterThan(text.length);
        editedXml = path.join(directory, "mini.edited.NodeSet2.xml");
        fs.writeFileSync(editedXml, added);
        edited = await load(editedXml, false);
        should(edited.nodes).eql(reference.nodes + 1);
    });
    after(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    it("loads from the XML when no image sits next to it", async () => {
        should(fs.existsSync(siblingImageFileOf(xmlFile))).eql(false);
        should(await load(xmlFile)).eql(reference);
    });

    it("replays the image next to the XML when its digest is the XML's", async () => {
        // the image of the edited document, claiming the original's digest: only a replay of the
        // sibling image can produce the edited content from the original path
        const claiming = imageClaiming(await nodesetFileToImage(editedXml), xmlFile);
        fs.writeFileSync(siblingImageFileOf(xmlFile), claiming);
        should(await load(xmlFile)).eql(edited);
    });

    it("ignores the sibling image with imageStore: false", async () => {
        should(await load(xmlFile, false)).eql(reference);
    });

    it("falls back to the XML when the image is stale, silently", async () => {
        fs.writeFileSync(siblingImageFileOf(xmlFile), await nodesetFileToImage(editedXml));
        should(await load(xmlFile)).eql(reference);
    });

    it("falls back to the XML when the image is of another schema, silently", async () => {
        const good = await nodesetFileToImage(xmlFile);
        const lines = zlib.gunzipSync(good).toString("utf8").split("\n");
        const header = JSON.parse(lines[0]);
        header.schema = header.schema + 1;
        lines[0] = JSON.stringify(header);
        fs.writeFileSync(siblingImageFileOf(xmlFile), zlib.gzipSync(lines.join("\n")));
        should(await load(xmlFile)).eql(reference);
    });

    it("falls back to the XML when the image is corrupt", async () => {
        fs.writeFileSync(siblingImageFileOf(xmlFile), Buffer.from([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]));
        should(await load(xmlFile)).eql(reference);
        const good = await nodesetFileToImage(xmlFile);
        fs.writeFileSync(siblingImageFileOf(xmlFile), good.subarray(0, good.length - 30));
        should(await load(xmlFile)).eql(reference);
    });

    it("falls back to the XML when the image was built from a document of another length, before hashing", async () => {
        // the trailer digest is the XML's: only the length check can tell this image apart
        const image = await nodesetFileToImage(editedXml);
        const lines = zlib.gunzipSync(image).toString("utf8").split("\n");
        const trailer = JSON.parse(lines[lines.length - 2]);
        trailer.sourceDigest = createHash("sha256").update(fs.readFileSync(xmlFile)).digest("hex");
        lines[lines.length - 2] = JSON.stringify(trailer);
        fs.writeFileSync(siblingImageFileOf(xmlFile), zlib.gzipSync(lines.join("\n")));
        should(await load(xmlFile)).eql(reference);
    });

    it("falls back to the XML when the document changed without changing length", async () => {
        // an edit that keeps the byte count: the length check passes, the digest decides
        const xml = fs.readFileSync(xmlFile, "utf8");
        const sameLength = xml.replace('BrowseName="Objects"', 'BrowseName="ObjectZ"');
        should(sameLength.length).eql(xml.length);
        const sameLengthFile = path.join(directory, "sameLength.NodeSet2.xml");
        fs.writeFileSync(sameLengthFile, sameLength);
        fs.writeFileSync(siblingImageFileOf(sameLengthFile), await nodesetFileToImage(xmlFile));
        const info = await readNodesetImageInfo(new Uint8Array(fs.readFileSync(siblingImageFileOf(sameLengthFile))));
        should(info.header.sourceLength).eql(fs.statSync(sameLengthFile).size);
        const loaded = await load(sameLengthFile);
        should(loaded).eql(await load(sameLengthFile, false));
        should(loaded).not.eql(reference);
    });

    it("reads the header and the trailer of a whole image from its ends, as the stream reader does", async () => {
        const image = await nodesetFileToImage(xmlFile);
        const whole = await readNodesetImageInfo(image);
        const streamed = await readNodesetImageInfo(
            (async function* () {
                for (let i = 0; i < image.length; i += 1000) yield image.subarray(i, i + 1000);
            })()
        );
        should(whole).eql(streamed);
        should(whole.trailer?.nodes).eql(whole.lines);
        // a truncated image: no trailer, the lines that are there are counted
        const lines = zlib.gunzipSync(image).toString("utf8").split("\n");
        const truncated = new Uint8Array(zlib.gzipSync(lines.slice(0, lines.length - 2).join("\n")));
        const info = await readNodesetImageInfo(truncated);
        should(info.trailer).be.null();
        should(info.lines).eql(whole.lines);
    });

    describe("the catalog", () => {
        it("ships an image next to every nodeset, with the digest of its XML", async () => {
            for (const meta of nodesetCatalog) {
                const xml = nodesets[meta.name];
                const image = nodesetImages[meta.name];
                should(image).eql(siblingImageFileOf(xml));
                should(fs.existsSync(image)).eql(true, `${meta.name}: ${image}`);
                const info = await readNodesetImageInfo(new Uint8Array(fs.readFileSync(image)));
                should(info.trailer?.sourceDigest).eql(createHash("sha256").update(fs.readFileSync(xml)).digest("hex"), meta.name);
                should(info.trailer?.nodes).eql(info.lines, meta.name);
            }
        });

        it("loads the same address space through the images as through the XML (standard and DI)", async () => {
            const files = [nodesets.standard, nodesets.di];
            const fromXml = AddressSpace.create();
            await generateAddressSpace(fromXml, files, { imageStore: false });
            const expected = digestAddressSpace(fromXml);
            fromXml.dispose();
            const fromImages = AddressSpace.create();
            await generateAddressSpace(fromImages, files);
            should(digestAddressSpace(fromImages)).eql(expected);
            fromImages.dispose();
            const fromImagePaths = AddressSpace.create();
            await generateAddressSpace(fromImagePaths, [nodesetImages.standard, nodesetImages.di]);
            should(digestAddressSpace(fromImagePaths)).eql(expected);
            fromImagePaths.dispose();
        });
    });
});
