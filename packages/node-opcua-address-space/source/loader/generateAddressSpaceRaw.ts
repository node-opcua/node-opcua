import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { CallbackT } from "node-opcua-status-code";
import { IAddressSpace } from "node-opcua-address-space-base";

import { adjustNamespaceArray } from "../../src/nodeset_tools/adjust_namespace_array";
import { NodeSetLoader } from "./load_nodeset2";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

/**
 * @param addressSpace the addressSpace to populate
 * @xmlFiles: a lis of xml files
 * @param xmlLoader - a helper function to return the content of the xml file
 */
export async function generateAddressSpaceRaw(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    xmlLoader: (nodeset2xmlUri: string) => Promise<string>
): Promise<void> {
    const nodesetLoader = new NodeSetLoader(addressSpace);

    if (!Array.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }
    for (let index = 0; index < xmlFiles.length; index++) {
        const xmlData = await xmlLoader(xmlFiles[index]);
        try {
            await nodesetLoader.addNodeSetAsync(xmlData);
        } catch (err) {
            errorLog("generateAddressSpace:  Loading xml file ", xmlFiles[index], " failed with error ", (err as Error).message);
            throw err;
        }
    }
    await nodesetLoader.terminateAsync();
    adjustNamespaceArray(addressSpace);
    // however process them in series
}

export type XmlLoaderFunc = (nodeset2xmlUri: string, callback: CallbackT<string>) => void;
export type XmlLoaderAsyncFunc = (nodeset2xmlUri: string) => Promise<string>;
