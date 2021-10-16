import * as should from "should";

import { BrowseDirection, makeNodeClassMask, makeResultMask } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { ReadValueIdOptions } from "node-opcua-types";

import { AddressSpace, PseudoSession } from "..";

import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("PseudoSession", () => {
    let addressSpace: AddressSpace;
    let session: PseudoSession;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        session = new PseudoSession(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should browse a single node ", async () => {
        // console.log(addressSpace.findNode("i=84")!.toString());

        const nodeToBrowse = /*BrowseDescription*/ {
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: false,
            nodeClassMask: makeNodeClassMask("Object"),
            nodeId: "i=84", // RootFolder
            referenceTypeId: null,
            resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
        };

        const browseResult = await session.browse(nodeToBrowse);

        browseResult.constructor.name.should.eql("BrowseResult");

        browseResult.references!.length.should.eql(3);
        browseResult.references![0].browseName.toString().should.eql("Objects");
        browseResult.references![1].browseName.toString().should.eql("Types");
        browseResult.references![2].browseName.toString().should.eql("Views");
    });

    it("should browse multiple nodes ", async () => {
        const nodeToBrowse = /*BrowseDescription*/ {
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: false,
            nodeClassMask: makeNodeClassMask("Object"),
            nodeId: "i=84",
            referenceTypeId: null,
            resultMask: makeResultMask("ReferenceType | IsForward | BrowseName | NodeClass | TypeDefinition")
        };

        const browseResults = await session.browse([nodeToBrowse, nodeToBrowse]);

        browseResults.should.be.instanceOf(Array);
        browseResults[0].constructor.name.should.eql("BrowseResult");
        browseResults[0].references!.length.should.eql(3);

        browseResults[0].references![0].browseName.toString().should.eql("Objects");
        browseResults[0].references![1].browseName.toString().should.eql("Types");
        browseResults[0].references![2].browseName.toString().should.eql("Views");

        browseResults[1].constructor.name.should.eql("BrowseResult");
        browseResults[1].references!.length.should.eql(3);
        browseResults[1].references![0].browseName.toString().should.eql("Objects");
        browseResults[1].references![1].browseName.toString().should.eql("Types");
        browseResults[1].references![2].browseName.toString().should.eql("Views");
    });

    it("should read a single node", async () => {
        const nodeToRead = /*ReadValue*/ {
            attributeId: AttributeIds.BrowseName,
            nodeId: "i=84"
        };

        const dataValue = await session.read(nodeToRead);

        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.value.toString().should.eql("Root");
    });

    it("should read multiple nodes", async () => {
        const nodesToRead: ReadValueIdOptions[] = [
            {
                attributeId: AttributeIds.BrowseName,
                nodeId: "i=84"
            },
            {
                attributeId: AttributeIds.BrowseName,
                nodeId: "i=85"
            }
        ];

        const dataValues = await session.read(nodesToRead);

        dataValues[0].statusCode.should.eql(StatusCodes.Good);
        dataValues[0].value.value.toString().should.eql("Root");

        dataValues[1].statusCode.should.eql(StatusCodes.Good);
        dataValues[1].value.value.toString().should.eql("Objects");
    });
});
