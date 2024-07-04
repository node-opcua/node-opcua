/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";

import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

import { getAddressSpaceFixture } from "./get_address_space_fixture";

export const mini_nodeset = "mini.Nodeset2.xml";
export const empty_nodeset = "fixture_empty_nodeset2.xml";

export const get_mini_nodeset_filename = (): string => getAddressSpaceFixture(mini_nodeset);
export const get_empty_nodeset_filename = (): string => getAddressSpaceFixture(empty_nodeset);

export async function getMiniAddressSpace(): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();

    // register namespace 1 (our namespace);
    const serverNamespace = addressSpace.registerNamespace("http://MYNAMESPACE");
    assert(serverNamespace.index === 1);

    await generateAddressSpace(addressSpace, get_mini_nodeset_filename(), {});
    return addressSpace;
}
