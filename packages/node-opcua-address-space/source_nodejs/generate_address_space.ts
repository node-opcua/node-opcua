import fs from "node:fs";
import type { IAddressSpace } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { generateAddressSpaceRaw, type NodeSetLoaderOptions } from "../dist/api/index.js";

const _doDebug = checkDebugFlag("generate_address_space");
const debugLog = make_debugLog("generate_address_space");
const errorLog = make_errorLog("generate_address_space");

export async function readNodeSet2XmlFile(xmlFile: string): Promise<string> {
    // c8 ignore next
    if (!fs.existsSync(xmlFile)) {
        const msg = `[NODE-OPCUA-E02] generateAddressSpace : cannot find nodeset2 xml file at ${xmlFile}`;
        errorLog(msg);
        throw new Error(msg);
    }
    if (_doDebug) {
        debugLog(" parsing ", xmlFile);
    }
    const xmlData = await fs.promises.readFile(xmlFile, "utf-8");
    return xmlData;
}

export async function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options?: NodeSetLoaderOptions
): Promise<void> {
    await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, options || {});
}
