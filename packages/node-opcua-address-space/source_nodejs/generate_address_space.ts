import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { IAddressSpace } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import {
    generateAddressSpaceRaw,
    type NamedNodesetSource,
    NODESET_RECORD_SCHEMA,
    type NodeSetLoaderOptions,
    type NodesetSource,
    type NodesetToImageOptions,
    nodesetToImage as nodesetToImageRaw,
    readNodesetImageInfo
} from "../dist/api/index.js";
import { FileNodesetImageStore } from "./nodeset_image_file_store.js";

const _doDebug = checkDebugFlag("generate_address_space");
const debugLog = make_debugLog("generate_address_space");
const errorLog = make_errorLog("generate_address_space");

function checkNodeSet2XmlFileExists(xmlFile: string): void {
    // c8 ignore next
    if (!fs.existsSync(xmlFile)) {
        const msg = `[NODE-OPCUA-E02] generateAddressSpace : cannot find nodeset2 xml file at ${xmlFile}`;
        errorLog(msg);
        throw new Error(msg);
    }
}

export async function readNodeSet2XmlFile(xmlFile: string): Promise<string> {
    checkNodeSet2XmlFileExists(xmlFile);
    if (_doDebug) {
        debugLog(" parsing ", xmlFile);
    }
    const xmlData = await fs.promises.readFile(xmlFile, "utf-8");
    return xmlData;
}

/** the chunk size of a nodeset file stream: a few dozen chunks for the standard nodeset */
const FILE_CHUNK_SIZE = 256 * 1024;

/**
 * a NodeSet2 file as a source the loader reads in chunks, opened when the loader gets to it
 */
export function nodesetSourceFromFile(xmlFile: string): NamedNodesetSource {
    return {
        name: xmlFile,
        source: () => {
            checkNodeSet2XmlFileExists(xmlFile);
            if (_doDebug) {
                debugLog(" parsing ", xmlFile);
            }
            return fs.createReadStream(xmlFile, { highWaterMark: FILE_CHUNK_SIZE });
        }
    };
}

/**
 * a NodeSet2 file read whole: what an image store needs, since the digest of the bytes is the
 * key and a stream can only be hashed once it has been parsed
 */
export function nodesetSourceFromFileWhole(xmlFile: string): NamedNodesetSource {
    checkNodeSet2XmlFileExists(xmlFile);
    return { name: xmlFile, source: () => [new Uint8Array(fs.readFileSync(xmlFile))] };
}

/** the image that sits next to a NodeSet2 file: <name>.ndjson.gz */
export function siblingImageFileOf(xmlFile: string): string {
    return xmlFile.replace(/\.xml$/i, ".ndjson.gz");
}

/**
 * the sibling store: when `<file>.ndjson.gz` sits next to `<file>.xml` and its trailer digest is
 * the SHA-256 of the XML bytes, the image is what the loader gets; otherwise the XML is. The
 * digest check is not optional and not cached: an XML edited in place next to a stale image
 * loads from the XML. Nothing is written here; writing images is the opt-in `imageStore`.
 * Returns the source to load, and which path was taken for the debug log.
 */
async function siblingOrXml(xmlFile: string): Promise<{ source: NamedNodesetSource; path: "image" | "xml"; reason?: string }> {
    checkNodeSet2XmlFileExists(xmlFile);
    const xml = new Uint8Array(fs.readFileSync(xmlFile));
    const asXml = (reason?: string) => ({
        source: { name: xmlFile, source: () => [xml] } as NamedNodesetSource,
        path: "xml" as const,
        reason
    });
    const imageFile = siblingImageFileOf(xmlFile);
    let image: Uint8Array;
    try {
        image = new Uint8Array(fs.readFileSync(imageFile));
    } catch {
        return asXml("no image next to it");
    }
    const digest = createHash("sha256").update(xml).digest("hex");
    try {
        const info = await readNodesetImageInfo(image);
        if (info.header.schema !== NODESET_RECORD_SCHEMA) {
            // a catalog package older or newer than this loader: its XML is still right
            return asXml(`the image is of schema ${info.header.schema}, this loader reads ${NODESET_RECORD_SCHEMA}`);
        }
        if (!info.trailer) return asXml("the image has no trailer");
        if (info.trailer.sourceDigest !== digest) return asXml("the image is stale: its digest is not the XML's");
        if (info.trailer.nodes !== info.lines) return asXml("the image is truncated");
    } catch (err) {
        return asXml(`the image cannot be read: ${(err as Error).message}`);
    }
    return { source: { name: `${xmlFile} (image)`, source: image }, path: "image" };
}

/** the version this package was built as, for the header of the images it writes */
export function addressSpacePackageVersion(): string {
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { version?: string };
        return packageJson.version ?? "unknown";
    } catch {
        return "unknown";
    }
}

/**
 * load NodeSet2 files into an address space. A file with a valid precompiled image next to it
 * (`<name>.ndjson.gz`, the catalog ships one for every nodeset) is replayed from the image, with
 * nothing to configure. With `imageStore`, a file without one is hashed and its image replayed
 * when the store has it, written otherwise; `true` selects the per-user file store
 * ({@link FileNodesetImageStore}). `imageStore: false` disables the sibling images too and
 * streams the XML, for tests and for bisecting.
 */
export async function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options?: NodeSetLoaderOptions
): Promise<void> {
    const files = Array.isArray(xmlFiles) ? xmlFiles : [xmlFiles];
    const loaderOptions: NodeSetLoaderOptions = { ...(options || {}) };
    if (loaderOptions.imageStore === false) {
        // no sibling images, no store: the XML files, streamed
        await generateAddressSpaceRaw(addressSpace, files.map(nodesetSourceFromFile), { ...loaderOptions, imageStore: undefined });
        return;
    }
    if (loaderOptions.imageStore === true) {
        loaderOptions.imageStore = new FileNodesetImageStore();
    }
    // the sibling store first: a catalog image is replayed with nothing to configure; what has
    // no valid image next to it goes through the XML, and through the store when there is one
    const sources: NodesetSource[] = [];
    for (const file of files) {
        const { source, path: taken, reason } = await siblingOrXml(file);
        debugLog(`generateAddressSpace: ${path.basename(file)} from ${taken}${reason ? ` (${reason})` : ""}`);
        sources.push(source);
    }
    await generateAddressSpaceRaw(addressSpace, sources, loaderOptions);
}

/** the precompiled image of a NodeSet2 file or source, stamped with this package's version */
export async function nodesetFileToImage(source: NodesetSource | string, options: NodesetToImageOptions = {}): Promise<Uint8Array> {
    const resolved: NodesetSource =
        typeof source === "string" && !source.trimStart().startsWith("<") ? nodesetSourceFromFileWhole(source) : source;
    return nodesetToImageRaw(resolved, { addressSpaceVersion: addressSpacePackageVersion(), ...options });
}
