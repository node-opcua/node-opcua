/**
 * A nodeset loads from anything that delivers its text: a path, a string, bytes, a stream of
 * chunks, a gzip stream; the address space must come out the same. A source that fails half-way
 * rejects the load and names the source.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import zlib from "node:zlib";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import {
    AddressSpace,
    generateAddressSpaceRaw,
    type NodesetSource,
    nodesetSourceFromStream,
    nodesetSourceFromUrl,
    type UAVariable
} from "../dist/api/index.js";
import type { AddressSpacePrivate } from "../dist/impl/address_space_private.js";
import {
    generateAddressSpace,
    nodesetSourceFromFile,
    nodesetSourceFromGzipFile,
    readNodeSet2XmlFile
} from "../distNodeJS/index.js";
import { get_mini_nodeset_filename } from "../test_helpers/get_mini_address_space.js";

interface Digest {
    nodes: number;
    references: number;
    hash: string;
}

function digest(addressSpace: AddressSpace): Digest {
    const lines: string[] = [];
    let references = 0;
    for (const namespace of addressSpace.getNamespaceArray()) {
        for (const node of namespace.nodeIterator()) {
            const refs = node.allReferences();
            references += refs.length;
            let line = `${node.nodeId.toString()}|${node.browseName.toString()}|${node.nodeClass}|${refs.length}`;
            if ((node as UAVariable).readValue) {
                line += `|${(node as UAVariable).readValue().value.toString()}`;
            }
            lines.push(line);
        }
    }
    lines.sort();
    return { nodes: lines.length, references, hash: createHash("sha1").update(lines.join("\n")).digest("hex") };
}

async function load(sources: NodesetSource[] | null, files?: string[]): Promise<Digest> {
    const addressSpace = AddressSpace.create();
    try {
        if (sources) {
            await generateAddressSpaceRaw(addressSpace, sources, {});
        } else {
            await generateAddressSpace(addressSpace, files || []);
        }
        return digest(addressSpace);
    } finally {
        addressSpace.dispose();
    }
}

async function* bytePieces(buffer: Buffer, size: number): AsyncGenerator<Uint8Array> {
    for (let i = 0; i < buffer.length; i += size) {
        yield new Uint8Array(buffer.subarray(i, i + size));
    }
}
async function* textPieces(text: string, size: number): AsyncGenerator<string> {
    for (let i = 0; i < text.length; i += size) {
        yield text.slice(i, i + size);
    }
}

describe("Loading a nodeset from a source", function (this: Mocha.Suite) {
    this.timeout(120000);

    let reference: Digest;
    before(async () => {
        // the whole-string path through a uri loader, as it always worked
        const addressSpace = AddressSpace.create();
        await generateAddressSpaceRaw(addressSpace, [nodesets.standard], readNodeSet2XmlFile, {});
        reference = digest(addressSpace);
        addressSpace.dispose();
        should(reference.nodes).be.greaterThan(5000);
    });

    it("from a path, read as a file stream", async () => {
        should(await load(null, [nodesets.standard])).eql(reference);
    });

    it("from a string", async () => {
        should(await load([fs.readFileSync(nodesets.standard, "utf8")])).eql(reference);
    });

    it("from UTF-8 bytes, byte-order mark included", async () => {
        const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(nodesets.standard)]);
        should(await load([new Uint8Array(bytes)])).eql(reference);
    });

    it("from a stream of 4 KB byte chunks", async () => {
        const bytes = fs.readFileSync(nodesets.standard);
        should(await load([{ name: "4k", source: () => bytePieces(bytes, 4096) }])).eql(reference);
    });

    it("from a gzip stream, each decompressed piece parsed as zlib produces it", async () => {
        // the pieces reach the loader as gunzip emits them: many, small, and never the whole document
        let pieces = 0;
        let largest = 0;
        async function* inflating(): AsyncGenerator<Uint8Array> {
            const gunzip = fs.createReadStream(nodesets.standard).pipe(zlib.createGzip()).pipe(zlib.createGunzip());
            for await (const piece of gunzip as AsyncIterable<Buffer>) {
                pieces += 1;
                largest = Math.max(largest, piece.length);
                yield piece;
            }
        }
        should(await load([{ name: "standard.gz", source: inflating }])).eql(reference);
        should(pieces).be.greaterThan(50);
        should(largest).be.lessThan(1024 * 1024);
    });

    it("from an already open stream that cannot be reopened", async () => {
        const stream = Readable.from(bytePieces(fs.readFileSync(nodesets.standard), 65536));
        should(await load([stream])).eql(reference);
    });

    it("from seven-character text chunks, for a small nodeset", async () => {
        const file = get_mini_nodeset_filename();
        const text = fs.readFileSync(file, "utf8");
        const expected = await load(null, [file]);
        should(await load([textPieces(`﻿${text}`, 7)])).eql(expected);
    });

    it("keeps two loads that run at the same time apart", async () => {
        // two servers in one process, each fed in chunks: the parsers must not share a reader state
        const text = fs.readFileSync(nodesets.standard, "utf8");
        const two = AddressSpace.create();
        const one = AddressSpace.create();
        try {
            await Promise.all([
                generateAddressSpaceRaw(one, [{ name: "one", source: () => textPieces(text, 1024) }], {}),
                generateAddressSpaceRaw(two, [{ name: "two", source: () => textPieces(text, 1061) }], {})
            ]);
            should(digest(one)).eql(reference);
            should(digest(two)).eql(reference);
        } finally {
            one.dispose();
            two.dispose();
        }
    });

    it("orders the documents by their dependencies whatever the order given", async () => {
        const expected = await load(null, [nodesets.standard, nodesets.di]);
        should(await load([nodesetSourceFromFile(nodesets.di), nodesetSourceFromFile(nodesets.standard)])).eql(expected);
    });

    it("rejects when a stream fails half-way, naming the source", async () => {
        const bytes = fs.readFileSync(nodesets.standard);
        async function* failing(): AsyncGenerator<Uint8Array> {
            yield new Uint8Array(bytes.subarray(0, 100000));
            throw new Error("disk on fire");
        }
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpaceRaw(addressSpace, [{ name: "flaky", source: failing }]);
            should.fail("", "", "expected the load to reject", "");
        } catch (err) {
            should((err as Error).message).match(/nodeset flaky/);
            should((err as Error).message).match(/disk on fire/);
        }
        should((addressSpace as unknown as AddressSpacePrivate).suspendBackReference).eql(false);
        addressSpace.dispose();
    });

    it("names an anonymous source by its position and kind", async () => {
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpaceRaw(addressSpace, [
                "<UANodeSet><Models></Models></UANodeSet>",
                new Uint8Array([60, 120, 62])
            ]);
            should.fail("", "", "expected the load to reject", "");
        } catch (err) {
            should((err as Error).message).match(/#2 \(bytes\)/);
        }
        addressSpace.dispose();
    });

    it("through generateAddressSpace, a list mixing file paths and sources", async () => {
        // a string is a path here; a source stands for what is not a file
        const gunzip = () => fs.createReadStream(nodesets.di).pipe(zlib.createGzip()).pipe(zlib.createGunzip());
        const expected = await load(null, [nodesets.standard, nodesets.di]);
        const addressSpace = AddressSpace.create();
        try {
            await generateAddressSpace(addressSpace, [nodesets.standard, { name: "di.gz", source: gunzip }]);
            should(digest(addressSpace)).eql(expected);
        } finally {
            addressSpace.dispose();
        }
    });

    describe("the source helpers", () => {
        let tmp: string;
        let gzipFile: string;
        let httpServer: http.Server;
        const httpPort = 5797;
        const baseUrl = `http://127.0.0.1:${httpPort}`;
        before(async () => {
            tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nodeset-helpers-"));
            gzipFile = path.join(tmp, "Opc.Ua.NodeSet2.xml.gz");
            fs.writeFileSync(gzipFile, zlib.gzipSync(fs.readFileSync(nodesets.standard)));
            // /plain.xml: the XML; /packed.xml.gz: gzip served as is; /encoded.xml: gzip with Content-Encoding
            httpServer = http.createServer((req, res) => {
                if (req.url === "/plain.xml") {
                    fs.createReadStream(nodesets.standard).pipe(res);
                } else if (req.url === "/packed.xml.gz") {
                    fs.createReadStream(gzipFile).pipe(res);
                } else if (req.url === "/encoded.xml") {
                    res.setHeader("content-encoding", "gzip");
                    fs.createReadStream(gzipFile).pipe(res);
                } else {
                    res.statusCode = 404;
                    res.end("no such model");
                }
            });
            await new Promise<void>((resolve) => httpServer.listen(httpPort, "127.0.0.1", resolve));
        });
        after(async () => {
            await new Promise<void>((resolve) => httpServer.close(() => resolve()));
            fs.rmSync(tmp, { recursive: true, force: true });
        });

        it("nodesetSourceFromGzipFile inflates a .xml.gz file", async () => {
            should(await load([nodesetSourceFromGzipFile(gzipFile)])).eql(reference);
        });

        it("nodesetSourceFromGzipFile names a file that does not exist when the loader opens it", async () => {
            const source = nodesetSourceFromGzipFile(path.join(tmp, "missing.xml.gz"));
            await load([source]).should.be.rejectedWith(/missing\.xml\.gz/);
        });

        it("nodesetSourceFromUrl fetches the XML", async () => {
            should(await load([nodesetSourceFromUrl(`${baseUrl}/plain.xml`)])).eql(reference);
        });

        it("nodesetSourceFromUrl inflates a .gz url, and a body fetch inflates on its own", async () => {
            should(await load([nodesetSourceFromUrl(`${baseUrl}/packed.xml.gz`)])).eql(reference);
            should(await load([nodesetSourceFromUrl(`${baseUrl}/encoded.xml`)])).eql(reference);
            should(await load([nodesetSourceFromUrl(`${baseUrl}/plain.xml`, { gzip: false })])).eql(reference);
        });

        it("nodesetSourceFromUrl rejects with the status and the url, when the loader gets to it", async () => {
            const before = nodesetSourceFromUrl(`${baseUrl}/nowhere.xml`, { init: { headers: { "x-test": "1" } } });
            await load([before]).should.be.rejectedWith(/cannot fetch http:\/\/127\.0\.0\.1:\d+\/nowhere\.xml: 404/);
        });

        it("nodesetSourceFromStream names a factory", async () => {
            const bytes = fs.readFileSync(nodesets.standard);
            let opened = 0;
            const source = nodesetSourceFromStream("pieces", () => {
                opened += 1;
                return bytePieces(bytes, 65536);
            });
            should(opened).eql(0);
            should(await load([source])).eql(reference);
            should(await load([source])).eql(reference, "the same value can be loaded again");
            should(opened).eql(2);
        });
    });

    it("turns the event loop while a chunked nodeset loads, as often as the budget says", async () => {
        const bytes = fs.readFileSync(nodesets.standard);
        const ticks = async (yieldEveryBytes: number) => {
            let count = 0;
            const timer = setInterval(() => count++, 20);
            const addressSpace = AddressSpace.create();
            await generateAddressSpaceRaw(addressSpace, [{ name: "paced", source: () => bytePieces(bytes, 65536) }], {
                yieldEveryBytes
            });
            addressSpace.dispose();
            clearInterval(timer);
            return count;
        };
        // the post-load steps turn the loop a few times on their own: measure against that
        const quiet = await ticks(0);
        should(await ticks(64 * 1024)).be.greaterThan(quiet + 4);
    });
});
