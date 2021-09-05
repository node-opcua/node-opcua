// tslint:disable:no-console
import * as should from "should";
import * as sinon from "sinon";

import { BrowseDirection } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";

import { AddressSpace, Namespace, UARootFolder, UAObjectType, UAReferenceType } from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing UAObject", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;
    let organizesReferenceType: UAReferenceType;
    let hasTypeDefinitionReferenceType: UAReferenceType;
    let baseObjectType: UAObjectType;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;
        organizesReferenceType = addressSpace.findReferenceType("Organizes")!;
        hasTypeDefinitionReferenceType = addressSpace.findReferenceType("HasTypeDefinition")!;
        baseObjectType = addressSpace.findObjectType("BaseObjectType")!;
    });
    after(async () => {
        addressSpace.dispose();
    });

    function dump(e: any) {
        console.log(e.toString({ addressSpace }));
    }

    it("AddressSpace#addObject should create a 'hasTypeDefinition' reference on node", () => {
        const nbReferencesBefore = baseObjectType.findReferencesEx("HasTypeDefinition", BrowseDirection.Inverse).length;

        const node1 = namespace.addObject({
            browseName: "Node1",
            typeDefinition: "BaseObjectType"
        });

        // xx node1.findReferencesEx("References", BrowseDirection.Forward).forEach(dump);

        const forwardReferences = node1.findReferencesEx("References", BrowseDirection.Forward);
        forwardReferences.length.should.eql(1);

        forwardReferences[0].referenceType.should.eql(resolveNodeId("HasTypeDefinition"));
        forwardReferences[0].isForward.should.eql(true);
        forwardReferences[0].nodeId.should.eql(baseObjectType.nodeId);

        const inverseReferences = node1.findReferencesEx("References", BrowseDirection.Inverse);
        inverseReferences.length.should.eql(0);

        const nbReferencesAfter = baseObjectType.findReferencesEx("HasTypeDefinition", BrowseDirection.Inverse).length;
        // xx console.log("",nbReferencesBefore,nbReferencesAfter);

        nbReferencesAfter.should.eql(
            nbReferencesBefore,
            "we should have no more inverse references on the BaseObjectType because we " +
                "do not add backward reference when reference is HasTypeDefinition"
        );

        should(node1.parent).eql(null, "node1 should have no parent");
    });

    function _test_with_custom_referenceType(referenceType: string | NodeId | UAReferenceType) {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        const nodeDest = namespace.addObject({
            browseName: "nodeDest"
        });

        node1.addReference({
            isForward: true,
            nodeId: nodeDest.nodeId,
            referenceType
        });

        const forwardReferences1 = node1.findReferencesEx("References", BrowseDirection.Forward);
        const inverseReferences1 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences1.length.should.eql(2);
        inverseReferences1.length.should.eql(0);
        forwardReferences1[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        // xx console.log(node1._references[0].toString({addressSpace: addressSpace}));
        // xx console.log(node1._references[1].toString({addressSpace: addressSpace}));
    }

    it("BaseNode#addReference - referenceType as ReferenceType BrowseName", () => {
        _test_with_custom_referenceType("Organizes");
    });

    it("BaseNode#addReference - referenceType as nodeId String", () => {
        const referenceType = addressSpace.findReferenceType("Organizes")!;
        _test_with_custom_referenceType(referenceType.nodeId.toString());
    });

    it("BaseNode#addReference - referenceType as NodeId", () => {
        const referenceType = addressSpace.findReferenceType("Organizes")!;
        _test_with_custom_referenceType(referenceType.nodeId);
    });

    it("BaseNode#addReference - nodeId as NodeId", () => {
        const node1 = namespace.addObject({ browseName: "Node1" });
        const nodeDest = namespace.addObject({ browseName: "nodeDest" });

        node1.addReference({
            nodeId: nodeDest,
            referenceType: "Organizes"
        });
        node1.getFolderElementByName("nodeDest")!.browseName.should.eql(nodeDest.browseName);
    });
    it("BaseNode#addReference - nodeId as Node", () => {
        const node1 = namespace.addObject({ browseName: "Node1" });
        const nodeDest = namespace.addObject({ browseName: "nodeDest" });

        node1.addReference({
            nodeId: nodeDest.nodeId,
            referenceType: "Organizes"
        });
        node1.getFolderElementByName("nodeDest")!.browseName.should.eql(nodeDest.browseName);
    });
    it("BaseNode#addReference - nodeId as String", () => {
        const node1 = namespace.addObject({ browseName: "Node1" });
        const nodeDest = namespace.addObject({ browseName: "nodeDest" });

        node1.addReference({
            nodeId: nodeDest.nodeId.toString(),
            referenceType: "Organizes"
        });
        node1.getFolderElementByName("nodeDest")!.browseName.should.eql(nodeDest.browseName);
    });

    it("BaseNode#addReference with invalid referenceType should raise an exception", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        const nodeDest = namespace.addObject({
            browseName: "nodeDest"
        });

        should(() => {
            node1.addReference({
                isForward: true,
                nodeId: nodeDest.nodeId,
                referenceType: "INVALID TYPE"
            });
        }).throwError();
    });

    it("BaseNode#addReference - four equivalent cases", () => {
        const view = namespace.addObject({ browseName: "View" });
        const node1 = namespace.addObject({ browseName: "Node1" });
        const node2 = namespace.addObject({ browseName: "Node2" });
        const node3 = namespace.addObject({ browseName: "Node3" });
        const node4 = namespace.addObject({ browseName: "Node4" });
        const node5 = namespace.addObject({ browseName: "Node5" });

        // the following addReference usages produce the same relationship
        node1.addReference({ referenceType: "OrganizedBy", nodeId: view.nodeId });
        node2.addReference({ referenceType: "OrganizedBy", nodeId: view });
        node3.addReference({ referenceType: "Organizes", isForward: false, nodeId: view.nodeId });
        view.addReference({ referenceType: "Organizes", nodeId: node4 });
        view.addReference({ referenceType: "OrganizedBy", isForward: false, nodeId: node5 });

        view.getFolderElementByName("Node1")!.browseName.toString().should.eql(node1.browseName.toString());
        view.getFolderElementByName("Node2")!.browseName.toString().should.eql(node2.browseName.toString());
        view.getFolderElementByName("Node3")!.browseName.toString().should.eql(node3.browseName.toString());
        view.getFolderElementByName("Node4")!.browseName.toString().should.eql(node4.browseName.toString());
        view.getFolderElementByName("Node5")!.browseName.toString().should.eql(node5.browseName.toString());
    });

    it("BaseNode#addReference - 2 nodes - should properly update backward references on referenced nodes", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        const nodeDest = namespace.addObject({
            browseName: "nodeDest"
        });

        node1.addReference({
            isForward: true,
            nodeId: nodeDest.nodeId,
            referenceType: "Organizes"
        });

        const forwardReferences1 = node1.findReferencesEx("References", BrowseDirection.Forward);
        const inverseReferences1 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences1.length.should.eql(2);
        inverseReferences1.length.should.eql(0);
        forwardReferences1[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        const forwardReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Forward);
        const inverseReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferencesDest.length.should.eql(1);
        inverseReferencesDest.length.should.eql(1);
        inverseReferencesDest[0].nodeId.toString().should.eql(node1.nodeId.toString());
    });

    it("BaseNode#addReference - 3 nodes - should properly update backward references on referenced nodes", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        const node2 = namespace.addObject({
            browseName: "Node2"
        });

        const nodeDest = namespace.addObject({
            browseName: "NodeDest"
        });

        node1.addReference({
            isForward: true,
            nodeId: nodeDest.nodeId,
            referenceType: "Organizes"
        });

        node2.addReference({
            isForward: true,
            nodeId: nodeDest.nodeId,
            referenceType: "Organizes"
        });

        const forwardReferences1 = node1.findReferencesEx("References", BrowseDirection.Forward);
        const inverseReferences1 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences1.length.should.eql(2);
        inverseReferences1.length.should.eql(0);
        forwardReferences1[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        const forwardReferences2 = node1.findReferencesEx("References", BrowseDirection.Forward);
        const inverseReferences2 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences2.length.should.eql(2);
        inverseReferences2.length.should.eql(0);
        forwardReferences2[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        const forwardReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Forward);
        const inverseReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferencesDest.length.should.eql(1);
        inverseReferencesDest.length.should.eql(2);
        inverseReferencesDest[0].nodeId.toString().should.eql(node1.nodeId.toString());
        inverseReferencesDest[1].nodeId.toString().should.eql(node2.nodeId.toString());
    });

    it("BaseNode#addReference should throw if the same reference is added twice", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        const node2 = namespace.addObject({
            browseName: "Node2"
        });

        node1.addReference({
            isForward: true,
            nodeId: node2.nodeId,
            referenceType: "Organizes"
        });

        should(function adding_the_same_reference_again() {
            node1.addReference({
                isForward: true,
                nodeId: node2.nodeId,
                referenceType: "Organizes"
            });
        }).throwError();
    });

    it("BaseNode#addReference internal cache must be invalidated", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        // let call a method that caches results
        node1.getComponents().length.should.eql(0);

        const node2 = namespace.addObject({
            browseName: "Node2"
        });

        // let call a method that caches results
        node2.getComponents().length.should.eql(0);

        sinon.spy(node1 as any, "_clear_caches");

        node1.addReference({
            isForward: true,
            nodeId: node2.nodeId,
            referenceType: "HasComponent"
        });

        (node1 as any)._clear_caches.callCount.should.eql(1);
        (node1 as any)._clear_caches.restore();

        // let verify that cache has been cleared by calling method that caches results
        // and verifying that results has changed as expected
        node1.getComponents().length.should.eql(1);
        node2.getComponents().length.should.eql(0);

        (node1 as any).node2.browseName.toString().should.eql("1:Node2");
    });
    it("BaseNode#addReference (Inverse) internal cache must be invalidated", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });

        node1.getComponents().length.should.eql(0);

        const node2 = namespace.addObject({
            browseName: "Node2"
        });
        node2.getComponents().length.should.eql(0);

        node2.addReference({
            isForward: false,
            nodeId: node1.nodeId,
            referenceType: "HasComponent"
        });

        node1.getComponents().length.should.eql(1);
        node2.getComponents().length.should.eql(0);

        (node1 as any).node2.browseName.toString().should.eql("1:Node2");
    });

    it("BaseNode#namespaceIndex", () => {
        const node1 = namespace.addObject({
            browseName: "Node1"
        });
        node1.namespaceIndex.should.eql(1);

        addressSpace.rootFolder.namespaceIndex.should.eql(0);
    });

    it("BaseNode#namespaceUri", () => {
        const node1 = namespace.addObject({
            browseName: "Node2"
        });
        node1.namespaceUri.should.eql("http://MYNAMESPACE");

        addressSpace.rootFolder.namespaceUri.should.eql("http://opcfoundation.org/UA/");
    });

    it("AddressSpace#parent should provide a parent property to access parent node", () => {
        const parentNode = namespace.addObject({
            browseName: "ParentNode"
        });

        const child1 = namespace.addObject({ componentOf: parentNode, browseName: "Child1" });
        child1.parent!.should.eql(parentNode);

        const child2 = namespace.addObject({ propertyOf: parentNode, browseName: "Child2" });
        child2.parent!.should.eql(parentNode);

        const child3 = namespace.addObject({ organizedBy: parentNode, browseName: "Child3" });
        should(child3.parent).eql(null, "OrganizedBy is not a Parent/Child relation");
    });
});
