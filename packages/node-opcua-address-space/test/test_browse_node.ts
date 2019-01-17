import * as should from "should";
import * as _ from "underscore";

import { BrowseDirection } from "node-opcua-data-model";
import { redirectToFile } from "node-opcua-debug";

import { resolveNodeId } from "node-opcua-nodeid";
import { BrowseDescription, BrowseDescriptionOptions } from "node-opcua-types";
import { AddressSpace, dumpBrowseDescription, dumpReferences } from "..";
import { getMiniAddressSpace } from "../";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space", () => {

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should dump references", (done: any) => {

        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;

        redirectToFile("dumpReferences.log", () => {
            dumpReferences(addressSpace, _.map((hr as any)._references, (x: any) => x));
        }, done);

    });

    it("should dump a browseDescription", (done: any) => {

        const browseDescription: BrowseDescriptionOptions = {
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: resolveNodeId("HierarchicalReferences"),
            resultMask: 0x3F
        };

        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;

        redirectToFile("dumpBrowseDescription.log", () => {
            dumpBrowseDescription(hr, browseDescription);
        }, done);

    });

    it("should provide a convenient a way to construct the node full name ", () => {

        const obj = addressSpace.findNode("Server_ServerStatus_BuildInfo")!;
        obj.fullName().should.eql("Server.ServerStatus.BuildInfo");

    });

});

describe("testing dump browseDescriptions", () => {

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(() => {
        addressSpace.dispose();
    });
    it("should provide a way to find a Method object by nodeId", () => {
        should.exist(addressSpace.findMethod("ns=0;i=11489"));
    });
});
