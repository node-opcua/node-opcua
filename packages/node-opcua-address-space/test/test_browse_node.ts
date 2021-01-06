import * as should from "should";

import { BrowseDirection } from "node-opcua-data-model";
import { redirectToFile } from "node-opcua-debug/nodeJS";

import { resolveNodeId } from "node-opcua-nodeid";
import { BrowseDescriptionOptions } from "node-opcua-types";
import { AddressSpace, dumpBrowseDescription, dumpReferences } from "..";
import { getMiniAddressSpace } from "../testHelpers";

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
        const references = addressSpace.rootFolder.findReferencesEx("References", BrowseDirection.Forward);
        redirectToFile(
            "dumpReferences.log",
            () => {
                dumpReferences(addressSpace, references);
            },
            done
        );
    });

    it("should dump a browseDescription", (done: any) => {
        const browseDescription: BrowseDescriptionOptions = {
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            nodeClassMask: 0, // 0 = all nodes
            referenceTypeId: resolveNodeId("HierarchicalReferences"),
            resultMask: 0x3f
        };

        const hr = addressSpace.findReferenceType("HierarchicalReferences")!;

        redirectToFile(
            "dumpBrowseDescription.log",
            () => {
                dumpBrowseDescription(hr, browseDescription);
            },
            done
        );
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
