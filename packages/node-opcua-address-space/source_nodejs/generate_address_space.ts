import fs from "node:fs";
import type { IAddressSpace } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { generateAddressSpaceRaw, type NamedNodesetSource, type NodeSetLoaderOptions } from "../dist/api/index.js";

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

export async function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options?: NodeSetLoaderOptions
): Promise<void> {
    const files = Array.isArray(xmlFiles) ? xmlFiles : [xmlFiles];
    await generateAddressSpaceRaw(addressSpace, files.map(nodesetSourceFromFile), options || {});
}
