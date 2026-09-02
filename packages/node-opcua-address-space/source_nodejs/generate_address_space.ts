import fs from "node:fs";
import path from "node:path";
import type { IAddressSpace } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import {
    generateAddressSpaceRaw,
    type NamedNodesetSource,
    type NodeSetLoaderOptions,
    type NodesetSource,
    type NodesetToImageOptions,
    nodesetToImage as nodesetToImageRaw
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
 * load NodeSet2 files into an address space. With `imageStore`, each file is read whole and
 * hashed, and its precompiled image is replayed when the store has it, written otherwise;
 * `imageStore: true` selects the per-user file store ({@link FileNodesetImageStore}).
 */
export async function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options?: NodeSetLoaderOptions
): Promise<void> {
    const files = Array.isArray(xmlFiles) ? xmlFiles : [xmlFiles];
    const loaderOptions: NodeSetLoaderOptions = { ...(options || {}) };
    if (loaderOptions.imageStore === true) {
        loaderOptions.imageStore = new FileNodesetImageStore();
    }
    const sources: NodesetSource[] = loaderOptions.imageStore
        ? files.map(nodesetSourceFromFileWhole)
        : files.map(nodesetSourceFromFile);
    await generateAddressSpaceRaw(addressSpace, sources, loaderOptions);
}

/** the precompiled image of a NodeSet2 file or source, stamped with this package's version */
export async function nodesetFileToImage(source: NodesetSource | string, options: NodesetToImageOptions = {}): Promise<Uint8Array> {
    const resolved: NodesetSource =
        typeof source === "string" && !source.trimStart().startsWith("<") ? nodesetSourceFromFileWhole(source) : source;
    return nodesetToImageRaw(resolved, { addressSpaceVersion: addressSpacePackageVersion(), ...options });
}
