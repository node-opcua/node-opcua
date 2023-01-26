import * as fs from "fs";
import { callbackify } from "util";

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
export function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    callback: (err?: Error) => void
): void;
export function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options: NodeSetLoaderOptions | undefined,
    callback: (err?: Error) => void
): void;
export function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    options?: NodeSetLoaderOptions
): Promise<void>;
export function generateAddressSpace(
    ... args: any[]
): any {
    const addressSpace = args[0] as IAddressSpace;
    const xmlFiles = args[1] as string | string[];
    if (args.length === 4) {
        const options = args[2] as NodeSetLoaderOptions | undefined;
        const callback = args[3]  as (err?: Error) => void;
        callbackify(generateAddressSpaceRaw)(addressSpace, xmlFiles, readNodeSet2XmlFile, options ||{}, callback!);
    } else {
        const options = {};
        const callback = args[2]  as (err?: Error) => void;
        callbackify(generateAddressSpaceRaw)(addressSpace, xmlFiles, readNodeSet2XmlFile, options, callback!);
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
(module.exports as any).generateAddressSpace = thenify.withCallback((module.exports as any).generateAddressSpace);
