/* eslint-disable max-statements */
import "should";
import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { BrowseDirection, NodeClassMask } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { resolveNodeId } from "node-opcua-nodeid";

import { AddressSpace, PseudoSession } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("BrowseNext", function () {
    let addressSpace: AddressSpace;
    this.beforeAll(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        const namespace = addressSpace.getOwnNamespace();
        const uaObjectWith3References = namespace.addObject({
            browseName: "MyObjectWith3References",
            nodeId: "s=MyObjectWith3References",
            organizedBy: addressSpace.rootFolder.objects
        });
        
        namespace.addObject({
            browseName: "SomeObject1",
            componentOf: uaObjectWith3References
        });

        namespace.addObject({
            browseName: "SomeObject2",
            componentOf: uaObjectWith3References
        });
        namespace.addObject({
            browseName: "SomeObject3",
            componentOf: uaObjectWith3References
        });
        // xx console.log(uaObjectWith3References.toString());
        const uaObjectWith3References2 = namespace.addObject({
            browseName: "MyObjectWith3References2",
            nodeId: "s=MyObjectWith3References2",
            organizedBy: addressSpace.rootFolder.objects
        });
        namespace.addObject({
            browseName: "SomeObject1",

            componentOf: uaObjectWith3References2
        });
        namespace.addObject({
            browseName: "SomeObject2",
            componentOf: uaObjectWith3References2
        });
        namespace.addObject({
            browseName: "SomeObject3",
            componentOf: uaObjectWith3References2
        });
    });
    this.afterAll(() => {
        addressSpace.dispose();
    });

    it("should browseNext (requestedMaxReferencesPerNode=1) ", async () => {
        const pseudoSession = new PseudoSession(addressSpace);

        const nodeToBrowse = {
            nodeId: resolveNodeId("ns=1;s=MyObjectWith3References"),
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: resolveNodeId("References"),
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.Object,
            resultMask: 63
        };
        const browse1 = await pseudoSession.browse(nodeToBrowse);
        //  console.log(browse1.toString());
        browse1.statusCode.should.eql(StatusCodes.Good);
        should(browse1.continuationPoint).eql(null);
        browse1.references!.length.should.eql(3);

        pseudoSession.requestedMaxReferencesPerNode = 1;

        const accumulatedReferences: any[] = [];
        const b1 = await pseudoSession.browse(nodeToBrowse);
        should.exist(b1.continuationPoint);
        b1.references!.length.should.eql(1);
        accumulatedReferences.push(...b1.references!);

        let continuationPoint = b1.continuationPoint!;
        const b2 = await pseudoSession.browseNext(continuationPoint, false);
        should.exist(b2.continuationPoint);
        b2.references!.length.should.eql(1);
        accumulatedReferences.push(...b2.references!);

        continuationPoint = b2.continuationPoint!;
        const b3 = await pseudoSession.browseNext(continuationPoint, false);
        should.not.exist(b3.continuationPoint);
        b3.references!.length.should.eql(1);
        accumulatedReferences.push(...b3.references!);

        continuationPoint = b3.continuationPoint!;
        if (continuationPoint) {
            const b4 = await pseudoSession.browseNext(continuationPoint, false);
            should.exist(b4.continuationPoint);
            b4.references!.length.should.eql(1);
            accumulatedReferences.push(...b4.references!);
        }

        accumulatedReferences.length.should.eql(3);

        accumulatedReferences.map((a) => a.browseName.toString()).should.eql(["1:SomeObject1", "1:SomeObject2", "1:SomeObject3"]);
    });

    it("should browseNext (requestedMaxReferencesPerNode=1) ", async () => {
        const pseudoSession = new PseudoSession(addressSpace);

        const nodeToBrowse = {
            nodeId: resolveNodeId("ns=1;s=MyObjectWith3References"),
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: resolveNodeId("References"),
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.Object,
            resultMask: 63
        };
        const browse1 = await pseudoSession.browse(nodeToBrowse);

        // console.log(browse1.toString());

        browse1.statusCode.should.eql(StatusCodes.Good);
        should(browse1.continuationPoint).eql(null);
        browse1.references!.length.should.eql(3);

        pseudoSession.requestedMaxReferencesPerNode = 1;

        const accumulatedReferences: any[] = [];
        const b1 = await pseudoSession.browse(nodeToBrowse);
        should.exist(b1.continuationPoint);
        b1.references!.length.should.eql(1);
        accumulatedReferences.push(...b1.references!);

        const continuationPoint = b1.continuationPoint!;
        const b2 = await pseudoSession.browseNext(continuationPoint, true /* want to fee continuation point */);
        should.not.exist(b2.continuationPoint);
        b2.references!.length.should.eql(0);

        const b3 = await pseudoSession.browseNext(continuationPoint, true);
        b3.statusCode.should.eql(StatusCodes.BadContinuationPointInvalid);

        accumulatedReferences.length.should.eql(1);

        accumulatedReferences.map((a) => a.browseName.toString()).should.eql(["1:SomeObject1"]);
    });
    it("ctt ", async () => {
        const pseudoSession = new PseudoSession(addressSpace);
        /*
          Validation is accomplished by first browsing all references on a node,
          then performing the test while comparing the appropriate references to the 
          references returned by each BrowseNext call. So this test only validates
          that Browse all references is consistent with Browse one reference
          followed by BrowseNexts. 
          */

        /**
         *
         *  Given two nodes to browse
         *    And the nodes exist
         *    And each node has at least three forward references
         */
        const nodeToBrowse1 = {
            nodeId: resolveNodeId("ns=1;s=MyObjectWith3References"),
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: resolveNodeId("References"),
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.Object,
            resultMask: 63
        };
        const nodeToBrowse2 = {
            nodeId: resolveNodeId("ns=1;s=MyObjectWith3References2"),
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: resolveNodeId("References"),
            includeSubtypes: true,
            nodeClassMask: NodeClassMask.Object,
            resultMask: 63
        };
        /**
         *    And RequestedMaxReferencesPerNode is 1
         *
         */
        pseudoSession.requestedMaxReferencesPerNode = 1;

        /**
         *     And Browse has been called separately for each node
         */
        const browseResult1 = await pseudoSession.browse(nodeToBrowse1);
        browseResult1.statusCode.should.eql(StatusCodes.Good);
        browseResult1.references!.length.should.eql(1);
        should.exist(browseResult1.continuationPoint);

        const browseResult2 = await pseudoSession.browse(nodeToBrowse2);
        browseResult2.statusCode.should.eql(StatusCodes.Good);
        browseResult2.references!.length.should.eql(1);
        should.exist(browseResult2.continuationPoint);

        browseResult1.continuationPoint.toString("hex").should.not.equal(browseResult2.continuationPoint.toString("hex"));

        const accumulatedReferencesNode1 = [...browseResult1.references!];
        const accumulatedReferencesNode2 = [...browseResult2.references!];

        /*
         * When BrowseNext is called
         */
        let continuationPoints = [browseResult1.continuationPoint, browseResult2.continuationPoint];

        console.log("continuationPoints", continuationPoints[0].toString(), continuationPoints[1].toString());

        const browseNextResult1 = await pseudoSession.browseNext(continuationPoints, false);

        /*
          Then the server returns references for both nodes
            And ContinuationPoints for both nodes
        */
        browseNextResult1[0].statusCode.should.eql(StatusCodes.Good);
        browseNextResult1[1].statusCode.should.eql(StatusCodes.Good);

        browseNextResult1[0].references!.length.should.eql(1);
        browseNextResult1[1].references!.length.should.eql(1);
        accumulatedReferencesNode1.push(...browseNextResult1[0].references!);
        accumulatedReferencesNode2.push(...browseNextResult1[1].references!);

        continuationPoints = [browseNextResult1[0].continuationPoint, browseNextResult1[1].continuationPoint];
        const browseNextResult2 = await pseudoSession.browseNext(continuationPoints, false);
        browseNextResult2[0].statusCode.should.eql(StatusCodes.Good);
        browseNextResult2[1].statusCode.should.eql(StatusCodes.Good);
        browseNextResult2[0].references!.length.should.eql(1);
        browseNextResult2[1].references!.length.should.eql(1);
        accumulatedReferencesNode1.push(...browseNextResult2[0].references!);
        accumulatedReferencesNode2.push(...browseNextResult2[1].references!);

        should.not.exist(browseNextResult2[0].continuationPoint);
        should.not.exist(browseNextResult2[1].continuationPoint);

        accumulatedReferencesNode1
            .map((a) => a.browseName.toString())
            .should.eql(["1:SomeObject1", "1:SomeObject2", "1:SomeObject3"]);
        accumulatedReferencesNode2
            .map((a) => a.browseName.toString())
            .should.eql(["1:SomeObject1", "1:SomeObject2", "1:SomeObject3"]);
    });
});
