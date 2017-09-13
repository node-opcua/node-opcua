"use strict";


var async = require("async");
var path = require("path");
var should = require("should");
var _ = require("underscore");

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var BrowseDirection = require("node-opcua-data-model").BrowseDirection;

var sinon = require("sinon");
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Testing UAObject", function () {

    var addressSpace, rootFolder;
    var organizesReferenceType;
    var hasTypeDefinitionReferenceType;
    var baseObjectType;

    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            rootFolder = addressSpace.findNode("RootFolder");
            organizesReferenceType = addressSpace.findReferenceType("Organizes");
            hasTypeDefinitionReferenceType = addressSpace.findReferenceType("HasTypeDefinition");
            baseObjectType = addressSpace.findObjectType("BaseObjectType");
            done(err);
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    function dump(e) {
        console.log(e.toString({addressSpace: addressSpace}));
    }

    it("AddressSpace#addObject should create a 'hasTypeDefinition' reference on node", function () {


        var nbReferencesBefore = baseObjectType.findReferencesEx("HasTypeDefinition", BrowseDirection.Inverse).length;

        var node1 = addressSpace.addObject({
            browseName: "Node1",
            typeDefinition: "BaseObjectType"
        });

        //xx node1.findReferencesEx("References", BrowseDirection.Forward).forEach(dump);

        var forwardReferences = node1.findReferencesEx("References", BrowseDirection.Forward);
        forwardReferences.length.should.eql(1);

        forwardReferences[0].referenceType.should.eql("HasTypeDefinition");
        forwardReferences[0].isForward.should.eql(true);
        forwardReferences[0].nodeId.should.eql(baseObjectType.nodeId);

        var inverseReferences = node1.findReferencesEx("References", BrowseDirection.Inverse);
        inverseReferences.length.should.eql(0);

        var nbReferencesAfter = baseObjectType.findReferencesEx("HasTypeDefinition", BrowseDirection.Inverse).length;
        //xx console.log("",nbReferencesBefore,nbReferencesAfter);

        nbReferencesAfter.should.eql(nbReferencesBefore,
          "we should have no more inverse references on the BaseObjectType because we do not add backward reference when reference is HasTypeDefinition");

        should(node1.parent).eql(undefined, "node1 should have no parent");
    });

    function _test_with_custom_referenceType(referenceType) {

        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });

        var nodeDest = addressSpace.addObject({
            browseName: "nodeDest"
        });

        node1.addReference({
            referenceType: referenceType,
            isForward: true,
            nodeId: nodeDest.nodeId
        });

        var forwardReferences1 = node1.findReferencesEx("References", BrowseDirection.Forward);
        var inverseReferences1 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences1.length.should.eql(2);
        inverseReferences1.length.should.eql(0);
        forwardReferences1[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        //xx console.log(node1._references[0].toString({addressSpace: addressSpace}));
        //xx console.log(node1._references[1].toString({addressSpace: addressSpace}));
    }

    it("BaseNode#addReference - referenceType as ReferenceType BrowseName", function () {
        _test_with_custom_referenceType("Organizes");
    });

    it("BaseNode#addReference - referenceType as nodeId String", function () {
        var referenceType = addressSpace.findReferenceType("Organizes");
        _test_with_custom_referenceType(referenceType.nodeId.toString());
    });

    it("BaseNode#addReference - referenceType as NodeId", function () {
        var referenceType = addressSpace.findReferenceType("Organizes");
        _test_with_custom_referenceType(referenceType.nodeId);
    });

    it("BaseNode#addReference - nodeId as NodeId", function () {
        var node1 = addressSpace.addObject({browseName: "Node1"});
        var nodeDest = addressSpace.addObject({browseName: "nodeDest"});

        node1.addReference({
            referenceType: "Organizes",
            nodeId: nodeDest
        });
        node1.getFolderElementByName("nodeDest").browseName.should.eql(nodeDest.browseName);
    });
    it("BaseNode#addReference - nodeId as Node", function () {
        var node1 = addressSpace.addObject({browseName: "Node1"});
        var nodeDest = addressSpace.addObject({browseName: "nodeDest"});

        node1.addReference({
            referenceType: "Organizes",
            nodeId: nodeDest.nodeId
        });
        node1.getFolderElementByName("nodeDest").browseName.should.eql(nodeDest.browseName);
    });
    it("BaseNode#addReference - nodeId as String", function () {
        var node1 = addressSpace.addObject({browseName: "Node1"});
        var nodeDest = addressSpace.addObject({browseName: "nodeDest"});

        node1.addReference({
            referenceType: "Organizes",
            nodeId: nodeDest.nodeId.toString()
        });
        node1.getFolderElementByName("nodeDest").browseName.should.eql(nodeDest.browseName);
    });

    it("BaseNode#addReference with invalid referenceType should raise an exception", function () {

        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });

        var nodeDest = addressSpace.addObject({
            browseName: "nodeDest"
        });

        should(function () {
            node1.addReference({
                referenceType: "INVALID TYPE",
                isForward: true,
                nodeId: nodeDest.nodeId
            });
        }).throwError();
    });

    it("BaseNode#addReference - four equivalent cases", function () {

        var view = addressSpace.addObject({browseName: "View"});
        var node1 = addressSpace.addObject({browseName: "Node1"});
        var node2 = addressSpace.addObject({browseName: "Node2"});
        var node3 = addressSpace.addObject({browseName: "Node3"});
        var node4 = addressSpace.addObject({browseName: "Node4"});
        var node5 = addressSpace.addObject({browseName: "Node5"});


        // the following addReference usages produce the same relationship
        node1.addReference({referenceType: "OrganizedBy", nodeId: view.nodeId});
        node2.addReference({referenceType: "OrganizedBy", nodeId: view});
        node3.addReference({referenceType: "Organizes", isForward: false, nodeId: view.nodeId});
        view.addReference({referenceType: "Organizes", nodeId: node4});
        view.addReference({referenceType: "OrganizedBy", isForward: false, nodeId: node5});


        view.getFolderElementByName("Node1").browseName.toString().should.eql(node1.browseName.toString());
        view.getFolderElementByName("Node2").browseName.toString().should.eql(node2.browseName.toString());
        view.getFolderElementByName("Node3").browseName.toString().should.eql(node3.browseName.toString());
        view.getFolderElementByName("Node4").browseName.toString().should.eql(node4.browseName.toString());
        view.getFolderElementByName("Node5").browseName.toString().should.eql(node5.browseName.toString());

    });

    it("BaseNode#addReference - 2 nodes - should properly update backward references on referenced nodes", function () {


        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });

        var nodeDest = addressSpace.addObject({
            browseName: "nodeDest"
        });

        node1.addReference({
            referenceType: "Organizes",
            isForward: true,
            nodeId: nodeDest.nodeId
        });

        var forwardReferences1 = node1.findReferencesEx("References", BrowseDirection.Forward);
        var inverseReferences1 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences1.length.should.eql(2);
        inverseReferences1.length.should.eql(0);
        forwardReferences1[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());


        var forwardReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Forward);
        var inverseReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferencesDest.length.should.eql(1);
        inverseReferencesDest.length.should.eql(1);
        inverseReferencesDest[0].nodeId.toString().should.eql(node1.nodeId.toString());

    });

    it("BaseNode#addReference - 3 nodes - should properly update backward references on referenced nodes", function () {

        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });

        var node2 = addressSpace.addObject({
            browseName: "Node2"
        });

        var nodeDest = addressSpace.addObject({
            browseName: "NodeDest"
        });

        node1.addReference({
            referenceType: "Organizes",
            isForward: true,
            nodeId: nodeDest.nodeId
        });

        node2.addReference({
            referenceType: "Organizes",
            isForward: true,
            nodeId: nodeDest.nodeId
        });

        var forwardReferences1 = node1.findReferencesEx("References", BrowseDirection.Forward);
        var inverseReferences1 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences1.length.should.eql(2);
        inverseReferences1.length.should.eql(0);
        forwardReferences1[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        var forwardReferences2 = node1.findReferencesEx("References", BrowseDirection.Forward);
        var inverseReferences2 = node1.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferences2.length.should.eql(2);
        inverseReferences2.length.should.eql(0);
        forwardReferences2[1].nodeId.toString().should.eql(nodeDest.nodeId.toString());

        var forwardReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Forward);
        var inverseReferencesDest = nodeDest.findReferencesEx("References", BrowseDirection.Inverse);

        forwardReferencesDest.length.should.eql(1);
        inverseReferencesDest.length.should.eql(2);
        inverseReferencesDest[0].nodeId.toString().should.eql(node1.nodeId.toString());
        inverseReferencesDest[1].nodeId.toString().should.eql(node2.nodeId.toString());

    });

    it("BaseNode#addReference should throw if the same reference is added twice", function () {

        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });

        var node2 = addressSpace.addObject({
            browseName: "Node2"
        });

        node1.addReference({
            referenceType: "Organizes",
            isForward: true,
            nodeId: node2.nodeId
        });

        should(function adding_the_same_reference_again() {
            node1.addReference({
                referenceType: "Organizes",
                isForward: true,
                nodeId: node2.nodeId
            });

        }).throwError();

    });

    it("BaseNode#addReference internal cache must be invalidated", function () {

        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });


        // let call a method that caches results
        node1.getComponents().length.should.eql(0);

        var node2 = addressSpace.addObject({
            browseName: "Node2"
        });

        // let call a method that caches results
        node2.getComponents().length.should.eql(0);


        sinon.spy(node1, "_clear_caches");

        node1.addReference({
            referenceType: "HasComponent",
            isForward: true,
            nodeId: node2.nodeId
        });

        node1._clear_caches.callCount.should.eql(1);
        node1._clear_caches.restore();

        // let verify that cache has been cleared by calling method that caches results
        // and verifying that results has changed as expected
        node1.getComponents().length.should.eql(1);
        node2.getComponents().length.should.eql(0);

        node1.node2.browseName.toString().should.eql("Node2");
    });
    it("BaseNode#addReference (Inverse) internal cache must be invalidated", function () {

        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });

        node1.getComponents().length.should.eql(0);

        var node2 = addressSpace.addObject({
            browseName: "Node2"
        });
        node2.getComponents().length.should.eql(0);


        node2.addReference({
            referenceType: "HasComponent",
            isForward: false,
            nodeId: node1.nodeId
        });

        node1.getComponents().length.should.eql(1);
        node2.getComponents().length.should.eql(0);

        node1.node2.browseName.toString().should.eql("Node2");

    });

    it("BaseNode#namespaceIndex", function () {
        var node1 = addressSpace.addObject({
            browseName: "Node1"
        });
        node1.namespaceIndex.should.eql(1);

        addressSpace.rootFolder.namespaceIndex.should.eql(0);
    });

    it("BaseNode#namespaceUri", function () {

        var node1 = addressSpace.addObject({
            browseName: "Node2"
        });
        node1.namespaceUri.should.eql("http://MYNAMESPACE");

        addressSpace.rootFolder.namespaceUri.should.eql("http://opcfoundation.org/UA/");
    });

    it("AddressSpace#parent should provide a parent property to access parent node", function () {

        var parentNode = addressSpace.addObject({
            browseName: "ParentNode"
        });

        var child1 = addressSpace.addObject({componentOf: parentNode, browseName: "Child1"});
        child1.parent.should.eql(parentNode);

        var child2 = addressSpace.addObject({propertyOf: parentNode, browseName: "Child2"});
        child2.parent.should.eql(parentNode);


        var child3 = addressSpace.addObject({organizedBy: parentNode, browseName: "Child3"});
        should(child3.parent).eql(undefined, "OrganizedBy is not a Parent/Child relation");

    });


});

