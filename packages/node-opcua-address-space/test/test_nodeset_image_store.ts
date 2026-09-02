/**
 * With an image store, a load replays the image of a document it has seen before and writes the
 * image of one it has not; an image that is corrupt, truncated or built from other bytes is
 * discarded and rebuilt; an edited document gets a fresh key; a source that holds an image is
 * replayed as such. The address space is the same on every path.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import {
    AddressSpace,
    generateAddressSpaceRaw,
    MemoryNodesetImageStore,
    type NodesetImageStore,
    type NodesetSource,
    nodesetImageKey,
    nodesetToImage,
    readNodesetImageInfo
} from "../dist/api/index.js";
import { FileNodesetImageStore, generateAddressSpace } from "../distNodeJS/index.js";
import { type AddressSpaceDigest, digestAddressSpace } from "../test_helpers/address_space_digest.js";
import { get_mini_nodeset_filename } from "../test_helpers/get_mini_address_space.js";

/** a store that counts what the loader asks of it */
class SpyStore implements NodesetImageStore {
    public gets: string[] = [];
    public puts: string[] = [];
    constructor(public readonly inner: NodesetImageStore = new MemoryNodesetImageStore()) {}
    async get(key: string): Promise<Uint8Array | undefined> {
        this.gets.push(key);
        return this.inner.get(key);
    }
    async put(key: string, image: Uint8Array): Promise<void> {
        this.puts.push(key);
        return this.inner.put(key, image);
    }
}

async function load(sources: NodesetSource[], store?: NodesetImageStore | boolean): Promise<AddressSpaceDigest> {
    const addressSpace = AddressSpace.create();
    try {
        await generateAddressSpaceRaw(addressSpace, sources, { imageStore: store });
        return digestAddressSpace(addressSpace);
    } finally {
        addressSpace.dispose();
    }
}

async function sha256(bytes: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("Loading through an image store", function (this: Mocha.Suite) {
    this.timeout(120000);

    const mini = get_mini_nodeset_filename();
    let miniXml: string;
    let miniBytes: Uint8Array;
    let miniDigest: string;
    let reference: AddressSpaceDigest;

    before(async () => {
        miniXml = fs.readFileSync(mini, "utf8");
        miniBytes = new Uint8Array(fs.readFileSync(mini));
        miniDigest = await sha256(miniBytes);
        reference = await load([miniBytes]);
    });

    it("parses the XML and writes the image the first time, replays the image the second time", async () => {
        const store = new SpyStore();
        should(await load([miniBytes], store)).eql(reference);
        should(store.gets).eql([nodesetImageKey(miniDigest)]);
        should(store.puts).eql([nodesetImageKey(miniDigest)]);
        should(await load([miniXml], store)).eql(reference);
        should(store.gets.length).eql(2);
        should(store.puts.length).eql(1, "the second load replayed the image and wrote nothing");
    });

    it("keys the image by the record schema and the digest of the bytes", () => {
        should(nodesetImageKey(miniDigest)).eql(`1-${miniDigest}`);
    });

    it("discards a corrupt image and rebuilds it", async () => {
        const store = new SpyStore();
        await load([miniBytes], store);
        const key = nodesetImageKey(miniDigest);
        const image = (await store.inner.get(key)) as Uint8Array;
        await store.inner.put(key, image.subarray(0, image.length - 40));
        should(await load([miniBytes], store)).eql(reference);
        should(store.puts).eql([key, key], "rebuilt once");
        const repaired = (await store.inner.get(key)) as Uint8Array;
        should(repaired.length).eql(image.length);
    });

    it("discards an image built from other bytes, and an edited document gets a fresh key", async () => {
        const store = new SpyStore();
        const edited = miniXml.replace("<UANodeSet", "<!-- edited --><UANodeSet");
        const editedDigest = await sha256(new TextEncoder().encode(edited));
        should(editedDigest).not.eql(miniDigest);
        // an image of the original filed under the edited document's key
        await load([miniBytes], store);
        const original = (await store.inner.get(nodesetImageKey(miniDigest))) as Uint8Array;
        await store.inner.put(nodesetImageKey(editedDigest), original);
        should(await load([edited], store)).eql(reference);
        should(store.puts).eql([nodesetImageKey(miniDigest), nodesetImageKey(editedDigest)]);
    });

    it("replays a source that holds an image, whether or not a store is configured", async () => {
        const image = await nodesetToImage(miniBytes, { addressSpaceVersion: "test" });
        should(await load([image])).eql(reference);
        should(await load([{ name: "mini image", source: image }], new MemoryNodesetImageStore())).eql(reference);
        const info = await readNodesetImageInfo(image);
        should(info.trailer?.sourceDigest).eql(miniDigest);
        should(info.header.sourceLength).eql(miniBytes.length);
    });

    it("chains an image and an XML file in dependency order", async () => {
        const standardImage = await nodesetToImage(new Uint8Array(fs.readFileSync(nodesets.standard)));
        const fromXml = AddressSpace.create();
        await generateAddressSpace(fromXml, [nodesets.standard, nodesets.di]);
        const expected = digestAddressSpace(fromXml);
        fromXml.dispose();
        should(await load([{ name: "di", source: () => fs.createReadStream(nodesets.di) }, standardImage])).eql(expected);
    });

    it("hashes a stream only once it is parsed: written, not looked up, unless a key is named", async () => {
        const store = new SpyStore();
        const stream = (): NodesetSource => ({
            name: "mini stream",
            source: () => fs.createReadStream(mini, { highWaterMark: 512 })
        });
        should(await load([stream()], store)).eql(reference);
        should(store.gets).eql([], "a stream cannot be looked up before it is read");
        should(store.puts).eql([nodesetImageKey(miniDigest)], "written under the digest computed on the way");
        should(await load([{ ...(stream() as object), imageKey: miniDigest } as NodesetSource], store)).eql(reference);
        should(store.gets).eql([nodesetImageKey(miniDigest)]);
        should(store.puts.length).eql(1, "replayed from the named key");
    });

    it("keeps the memory store within its size, dropping the least recently used image", async () => {
        const store = new MemoryNodesetImageStore(150);
        await store.put("a", new Uint8Array(100));
        await store.put("b", new Uint8Array(100));
        should(store.keys()).eql(["b"]);
        await store.put("c", new Uint8Array(40));
        await store.get("b");
        await store.put("d", new Uint8Array(40));
        should(store.keys()).eql(["b", "d"]);
    });

    describe("the file store", () => {
        let directory: string;
        before(() => {
            directory = fs.mkdtempSync(path.join(os.tmpdir(), "nodeset-images-"));
        });
        after(() => {
            fs.rmSync(directory, { recursive: true, force: true });
        });

        it("keeps images as files, written atomically, and evicts the oldest past its size", async () => {
            const store = new FileNodesetImageStore({ directory, maxBytes: 100 * 1024 });
            should(await store.get("1-missing")).eql(undefined);
            const digestA = await load([miniBytes], store);
            should(digestA).eql(reference);
            const key = nodesetImageKey(miniDigest);
            should(await store.keys()).eql([key]);
            should(fs.readdirSync(directory).filter((n) => n.endsWith(".tmp"))).eql([]);
            const image = (await store.get(key)) as Uint8Array;
            should(image.length).be.greaterThan(100);
            // a large image pushes the earlier one out
            await new Promise((resolve) => setTimeout(resolve, 20));
            await store.put("1-big", new Uint8Array(100 * 1024));
            should(await store.keys()).eql(["1-big"]);
        });

        it("ignores a corrupt file and lets the loader rebuild it", async () => {
            const store = new FileNodesetImageStore({ directory });
            const key = nodesetImageKey(miniDigest);
            fs.writeFileSync(path.join(directory, `${key}.ndjson.gz`), Buffer.from([0x1f, 0x8b, 1, 2, 3]));
            should(await load([miniBytes], store)).eql(reference);
            const rebuilt = (await store.get(key)) as Uint8Array;
            should(rebuilt.length).be.greaterThan(100);
        });

        it("is what imageStore: true selects in the Node.js generateAddressSpace", async () => {
            const previous = process.env.NODE_OPCUA_NODESET_IMAGE_DIR;
            process.env.NODE_OPCUA_NODESET_IMAGE_DIR = path.join(directory, "default");
            try {
                const addressSpace = AddressSpace.create();
                await generateAddressSpace(addressSpace, [mini], { imageStore: true });
                should(digestAddressSpace(addressSpace)).eql(reference);
                addressSpace.dispose();
                should(fs.readdirSync(path.join(directory, "default"))).eql([`${nodesetImageKey(miniDigest)}.ndjson.gz`]);
            } finally {
                if (previous === undefined) delete process.env.NODE_OPCUA_NODESET_IMAGE_DIR;
                else process.env.NODE_OPCUA_NODESET_IMAGE_DIR = previous;
            }
        });
    });
});
