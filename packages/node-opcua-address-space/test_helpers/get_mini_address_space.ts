/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";

import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

import { getAddressSpaceFixture } from "./get_address_space_fixture";

export const mini_nodeset = "mini.Node.Set2.xml";
export const empty_nodeset = "fixture_empty_nodeset2.xml";

export const get_mini_nodeset_filename = (): string => getAddressSpaceFixture(mini_nodeset);
export const get_empty_nodeset_filename = (): string => getAddressSpaceFixture(empty_nodeset);

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");

export function getMiniAddressSpace(callback: (err: Error | null, addressSpace?: AddressSpace) => void): void;
export function getMiniAddressSpace(): Promise<AddressSpace>;
export function getMiniAddressSpace(...args: any[]): any {
    const callback = args[0] as (err: Error | null, addressSpace?: AddressSpace) => void;

    const addressSpace = AddressSpace.create();

    // register namespace 1 (our namespace);
    const serverNamespace = addressSpace.registerNamespace("http://MYNAMESPACE");
    assert(serverNamespace.index === 1);

    generateAddressSpace(addressSpace, get_mini_nodeset_filename(), (err?: Error) => {
        // istanbul ignore next
        if (err) {
            // tslint:disable:no-console
            console.log("err =", err);
        }
        callback(err || null, addressSpace);
    });
}

(module.exports as any).getMiniAddressSpace = thenify.withCallback((module.exports as any).getMiniAddressSpace);
