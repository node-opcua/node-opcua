"use strict";
require("requirish")._(module);
var should = require("should");
var assert = require("assert");

var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

var NodeId = require("lib/datamodel/nodeid").NodeId;
var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

describe("testing address space", function () {

    var addressSpace = null, rootFolder;

    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        before(function (done) {
            get_mini_address_space(function (err, data) {
                addressSpace = data;
                rootFolder = addressSpace.findObject("RootFolder");
                done(err);
            });
        });
        after(function(){
            if (addressSpace){
                addressSpace.dispose();
                addressSpace = null;
            }
            rootFolder = null;
        });

    });



    function findReference(references, nodeId) {
        assert(nodeId instanceof NodeId);
        return references.filter(function (r) {
            return r.nodeId.toString() === nodeId.toString();
        });
    }

    it("should be possible to remove an object previously added to the address space", function () {

        var options = {
            organizedBy: "RootFolder",
            browseName: "SomeObject"
        };

        var object = addressSpace.addObject(options);

        // object shall  be found with a global nodeId search
        addressSpace.findObject(object.nodeId).should.eql(object);

        // object shall  be found in parent folder
        var references = rootFolder.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(1);


        // root folder should organize the object
        rootFolder.getFolderElementByName("SomeObject").browseName.toString().should.eql("SomeObject");

        // ------------------------------------- NOW DELETE THE OBJECT
        addressSpace.deleteObject(object.nodeId);

        // object shall not be found with a global nodeId search
        should(addressSpace.findObject(object.nodeId)).eql(undefined);

        // object shall not be found in parent folder anymore
        references = rootFolder.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(0);

        should(rootFolder.getFolderElementByName("SomeObject")).eql(null);

    });

    describe("BaseNode#findReferencesEx",function() {

        it("should find HierarchicalReferences",function() {

            var object = addressSpace.addObject({
                organizedBy: "RootFolder",
                browseName: "ChildObject"
            });

            object.findReferencesEx("HierarchicalReferences",BrowseDirection.Inverse).length.should.eql(1,"Object must be child of one parent");
            object.findReferencesEx("HierarchicalReferences",BrowseDirection.Forward).length.should.eql(0,"Object must not have children yet");

            var comp1 = addressSpace.addVariable({ componentOf: object,browseName: "Component1", dataType: "String"});
            object.findReferencesEx("HierarchicalReferences",BrowseDirection.Forward).length.should.eql(1,"Object must now have one child");

            object.findReferencesEx("HasChild",    BrowseDirection.Forward).length.should.eql(1,"Object must now have one child");
            //xx object.findReferencesEx("ChildOf",true).length.should.eql(1,"Object must now have one child");

            object.findReferencesEx("Aggregates",  BrowseDirection.Forward).length.should.eql(1,"Object must now have one child");
            object.findReferencesEx("HasComponent",BrowseDirection.Forward).length.should.eql(1,"Object must now have one child");
            object.findReferencesEx("HasProperty", BrowseDirection.Forward).length.should.eql(0,"Object must now have one child");
            object.findReferencesEx("Organizes",   BrowseDirection.Forward).length.should.eql(0,"Object must now have one child");

        });

    });

    describe("AddressSpace#deleteObject",function() {

        it("should  remove an object previously added to a folder of an  address space (and its children)", function () {

            var options = {
                organizedBy: "RootFolder",
                browseName: "SomeObject"
            };
            var object = addressSpace.addObject(options);
            var innerVar = addressSpace.addVariable({ componentOf: object,browseName: "Hello", dataType: "String"});

            // objects shall  be found with a global nodeId search
            addressSpace.findObject(object.nodeId).should.eql(object);
            addressSpace.findObject(innerVar.nodeId).should.eql(innerVar);

            var references = object.findReferences("HasComponent", true);
            findReference(references, innerVar.nodeId).length.should.eql(1);

            references = rootFolder.findReferences("Organizes", true);
            findReference(references, object.nodeId).length.should.eql(1);

            //---------------------------------------------------------
            addressSpace.deleteObject(object.nodeId);
            //---------------------------------------------------------

            // object shall not be found with a global nodeId search
            should(addressSpace.findObject(object.nodeId)).eql(undefined);
            should(addressSpace.findObject(innerVar.nodeId)).eql(undefined);

            references = rootFolder.findReferences("Organizes", true);
            findReference(references, object.nodeId).length.should.eql(0);

        });
        it("should remove a component of a existing object",function() {

            // give an object
            var object = addressSpace.addObject({organizedBy:"RootFolder", browseName: "MyObject1"});

            // let's construct some properties and some components gradually, and verify that the caches
            // work as expected.
            var comp1 = addressSpace.addVariable({ componentOf: object,browseName: "Component1", dataType: "String"});
            var prop1 = addressSpace.addVariable({ propertyOf:  object,browseName: "Property1",  dataType: "String"});

            object.getComponents().length.should.eql(1);
            object.getComponents()[0].browseName.toString().should.eql("Component1");

            object.getProperties().length.should.eql(1);
            object.getProperties()[0].browseName.toString().should.eql("Property1");

            var comp2 = addressSpace.addVariable({ componentOf: object,browseName: "Component2", dataType: "String"});
            var prop2 = addressSpace.addVariable({ propertyOf:  object,browseName: "Property2",  dataType: "String"});

            object.getComponents().length.should.eql(2);
            object.getComponents()[0].browseName.toString().should.eql("Component1");
            object.getComponents()[1].browseName.toString().should.eql("Component2");

            object.getProperties().length.should.eql(2);
            object.getProperties()[0].browseName.toString().should.eql("Property1");
            object.getProperties()[1].browseName.toString().should.eql("Property2");

            // now lets remove Prop1
            addressSpace.deleteObject(prop1.nodeId);
            object.getProperties().length.should.eql(1);
            object.getProperties()[0].browseName.toString().should.eql("Property2");


        });
    });

    describe("AddressSpace#findCorrespondingBasicDataType",function() {

        var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
        var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;
        var DataType = require("lib/datamodel/variant").DataType;
        var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

        it("should findCorrespondingBasicDataType i=13 => DataType.String",function() {

            var dataType = addressSpace.findDataType(resolveNodeId("i=12"));
            dataType.browseName.toString().should.eql("String");
            addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);

        });

        it("should findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject",function() {

            var dataType = addressSpace.findDataType(makeNodeId( DataTypeIds.BuildInfo)); // ServerStatus
            dataType.browseName.toString().should.eql("BuildInfo");
            addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
        });

        it("should findCorrespondingBasicDataType variation 1 - Alias",function() {
            addressSpace.findCorrespondingBasicDataType("Int32").should.eql(DataType.Int32);
        });
        it("should findCorrespondingBasicDataType variation 2 - nodeId as String",function() {
            addressSpace.findCorrespondingBasicDataType("i=13").should.eql(DataType.DateTime);
        });
        it("should findCorrespondingBasicDataType variation 3 - nodeId as NodeId",function() {
            addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
        });

        it("should findCorrespondingBasicDataType i=852 (Enumeration ServerState) => UInt32",function() {
            addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.ServerState)).should.eql(DataType.Int32);
        });
    });

    describe("AddressSpace#findCorrespondingBasicDataType",function() {

        var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
        var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;
        var DataType = require("lib/datamodel/variant").DataType;
        var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

        it("should findCorrespondingBasicDataType i=13 => DataType.String",function() {

            var dataType = addressSpace.findDataType(resolveNodeId("i=12"));
            dataType.browseName.toString().should.eql("String");
            addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);

        });

        it("should findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject",function() {

            var dataType = addressSpace.findDataType(makeNodeId( DataTypeIds.BuildInfo)); // ServerStatus
            dataType.browseName.toString().should.eql("BuildInfo");
            addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
        });

        it("should findCorrespondingBasicDataType variation 1 - Alias",function() {
            addressSpace.findCorrespondingBasicDataType("Int32").should.eql(DataType.Int32);
        });
        it("should findCorrespondingBasicDataType variation 2 - nodeId as String",function() {
            addressSpace.findCorrespondingBasicDataType("i=13").should.eql(DataType.DateTime);
        });
        it("should findCorrespondingBasicDataType variation 3 - nodeId as NodeId",function() {
            addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
        });
    });


});
