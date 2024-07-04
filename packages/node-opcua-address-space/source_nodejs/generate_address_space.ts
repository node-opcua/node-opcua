import fs from "fs";

import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { IAddressSpace } from "node-opcua-address-space-base";

import { generateAddressSpaceRaw } from "..";
import { NodeSetLoaderOptions } from "../source/interfaces/nodeset_loader_options";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

export async function readNodeSet2XmlFile(xmlFile: string): Promise<string> {
    // istanbul ignore next
    if (!fs.existsSync(xmlFile)) {
        const msg = "[NODE-OPCUA-E02] generateAddressSpace : cannot find nodeset2 xml file at " + xmlFile;
        errorLog(msg);
        throw new Error(msg);
    }
    debugLog(" parsing ", xmlFile);
    const xmlData = await fs.promises.readFile(xmlFile, "utf-8");
    return xmlData;
}

export async function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options?: NodeSetLoaderOptions
): Promise<void>
{
    await generateAddressSpaceRaw(addressSpace, xmlFiles, readNodeSet2XmlFile, options || {});
}
