import should from "should";

import { BrowseDirection, makeNodeClassMask, makeResultMask } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { ReadValueIdOptions } from "node-opcua-types";

import { DataType } from "node-opcua-basic-types";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { AddressSpace, PseudoSession } from "..";

import { getMiniAddressSpace } from "../testHelpers";

describe("PseudoSession", () => {
    let addressSpace: AddressSpace;
    let session: PseudoSession;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        addressSpace.registerNamespace("Private");
        const namespace = addressSpace.getOwnNamespace();   
     
        const uaVariable1 = namespace.addVariable({
            browseName: "MyVariable1",
            dataType: "Double",
            nodeId: "s=MyVariable1",
            componentOf: addressSpace.rootFolder.objects.server,
            value: { dataType: DataType.Double, value: 10.0 }
        });
        const uaVariable2 = namespace.addVariable({
            browseName: "MyVariable2",
            dataType: "Double",
            nodeId: "s=MyVariable2",
            componentOf: addressSpace.rootFolder.objects.server,
            value: { dataType: DataType.Double, value: 10.0 }
        });
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

    it("should write multiple nodes", async () => {


        const nodesToWrite = [
            {
                nodeId: "ns=1;s=MyVariable1",
                attributeId: AttributeIds.Value,
                value: {
                    value: {
                        dataType: DataType.Double,
                        value: 100.0
                    }
                }
            },
            {
                nodeId: "ns=1;s=MyVariable2",
                attributeId: AttributeIds.Value,
                value: {
                    value: {
                        dataType: DataType.Double,
                        value: 200.0
                    }
                }
            }
        ];
        const statusCodes =  await session.write(nodesToWrite);
        statusCodes.length.should.eql(2);
        statusCodes[0].should.eql(StatusCodes.Good);
        statusCodes[1].should.eql(StatusCodes.Good);

    });


});
