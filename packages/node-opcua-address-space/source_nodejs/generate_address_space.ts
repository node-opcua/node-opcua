import * as fs from "fs";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { ErrorCallback } from "node-opcua-status-code";
import { IAddressSpace } from "node-opcua-address-space-base";

import { generateAddressSpaceRawCallback } from "..";
const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

export function readNodeSet2XmlFile(xmlFile: string, callback: (err: Error | null, xmlData?: string) => void): void {
    // istanbul ignore next
    if (!fs.existsSync(xmlFile)) {
        const msg = "[NODE-OPCUA-E02] generateAddressSpace : cannot find nodeset2 xml file at " + xmlFile;
        errorLog(msg);
        return callback(new Error(msg));
    }
    debugLog(" parsing ", xmlFile);
    fs.readFile(xmlFile, "ascii", (err, xmlData: string) => {
        callback(err, xmlData);
    });
}
export function generateAddressSpace(
    addressSpace: IAddressSpace,
    xmlFiles: string | string[],
    callback: (err?: Error) => void
): void;
export function generateAddressSpace(addressSpace: IAddressSpace, xmlFiles: string | string[]): Promise<void>;
export function generateAddressSpace(addressSpace: IAddressSpace, xmlFiles: string | string[], callback?: ErrorCallback): any {
    generateAddressSpaceRawCallback(addressSpace, xmlFiles, readNodeSet2XmlFile, callback);
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
(module.exports as any).generateAddressSpace = thenify.withCallback((module.exports as any).generateAddressSpace);
