import async = require("async");
import * as fs from "fs";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ErrorCallback } from "node-opcua-status-code";
import { AddressSpace as AddressSpacePublic } from "../dist/source";
import { AddressSpace } from "../dist/src/address_space";
import { NodeSetLoader } from "../dist/source/loader/load_nodeset2";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

export function _generateAddressSpace(
    addressSpace: AddressSpacePublic,
    xmlFiles: string | string[],
    xmlLoader: (nodeset2xmluri: string) => Promise<string>,
    callback?: ErrorCallback
): any {
    const nodesetLoader = new NodeSetLoader(addressSpace as AddressSpace);

    if (!Array.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }
    async.mapSeries(
        xmlFiles,
        (xmlFile: string, callback1: (err?: Error) => void) => {
            readFile(xmlFile, (err: Error | null, xmlData?: string) => {
                if (err) {
                    return callback1(err);
                }
                nodesetLoader.addNodeSet(xmlData!, callback1);
                callback1();
            });
        },
        (err?: Error | null) => {
            nodesetLoader.terminate(callback!);
        }
    );
}
function readFile(xmlFile: string, callback: (err: Error | null, xmlData?: string) => void) {
    // istanbul ignore next
    if (!fs.existsSync(xmlFile)) {
        return callback(new Error("generateAddressSpace : cannot file nodeset2 xml file at " + xmlFile));
    }
    debugLog(" parsing ", xmlFile);
    fs.readFile(xmlFile, "ascii", (err, xmlData: string) => {
        callback(err, xmlData);
    });
}
export function generateAddressSpace(
    addressSpace: AddressSpacePublic,
    xmlFiles: string | string[],
    callback: (err?: Error) => void
): void;

export function generateAddressSpace(addressSpace: AddressSpacePublic, xmlFiles: string | string[]): Promise<void>;
export function generateAddressSpace(addressSpace: AddressSpacePublic, xmlFiles: string | string[], callback?: ErrorCallback): any {
    const nodesetLoader = new NodeSetLoader(addressSpace as AddressSpace);

    if (!Array.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }
    async.mapSeries(
        xmlFiles,
        (xmlFile: string, callback1: (err?: Error) => void) => {
            // istanbul ignore next
            if (!fs.existsSync(xmlFile)) {
                throw new Error("generateAddressSpace : cannot file nodeset2 xml file at " + xmlFile);
            }
            debugLog(" parsing ", xmlFile);
            fs.readFile(xmlFile, "ascii", (err, xmlData: string) => {
                nodesetLoader.addNodeSet(xmlData, callback1);
            });
        },
        (err?: Error | null) => {
            nodesetLoader.terminate(callback!);
        }
    );
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
(module.exports as any).generateAddressSpace = thenify.withCallback((module.exports as any).generateAddressSpace);
