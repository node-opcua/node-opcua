"use strict";

const should = require("should");
const assert = require("node-opcua-assert").assert;

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const NodeId = require("node-opcua-nodeid").NodeId;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;


const context = require("..").SessionContext.defaultContext;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const DataTypeIds = require("node-opcua-constants").DataTypeIds;
const DataType = require("node-opcua-variant").DataType;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing address space", function () {

    let addressSpace = null, rootFolder;


    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            rootFolder = addressSpace.findNode("RootFolder");
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        rootFolder = null;
    });


    function findReference(references, nodeId) {
        assert(nodeId instanceof NodeId);
        return references.filter(function (r) {
            return r.nodeId.toString() === nodeId.toString();
        });
    }


    it("BaseNode#findReferencesEx - should find HierarchicalReferences", function () {

        const object = addressSpace.addObject({
            organizedBy: "RootFolder",
            browseName: "ChildObject"
        });

        object.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse).length.should.eql(1, "Object must be child of one parent");
        object.findReferencesEx("HierarchicalReferences", BrowseDirection.Forward).length.should.eql(0, "Object must not have children yet");

        const comp1 = addressSpace.addVariable({componentOf: object, browseName: "Component1", dataType: "String"});
        object.findReferencesEx("HierarchicalReferences", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");

        object.findReferencesEx("HasChild", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");
        //xx object.findReferencesEx("ChildOf",true).length.should.eql(1,"Object must now have one child");

        object.findReferencesEx("Aggregates", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");
        object.findReferencesEx("HasComponent", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");
        object.findReferencesEx("HasProperty", BrowseDirection.Forward).length.should.eql(0, "Object must now have one child");
        object.findReferencesEx("Organizes", BrowseDirection.Forward).length.should.eql(0, "Object must now have one child");

    });


    it("AddressSpace#deleteNode - should remove an object from the address space", function () {

        const options = {
            organizedBy: "ObjectsFolder",
            browseName: "SomeObject"
        };

        const object = addressSpace.addObject(options);

        // object shall be found with a global nodeId search
        addressSpace.findNode(object.nodeId).should.eql(object);

        // object shall be found in parent folder
        let references = rootFolder.objects.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(1);


        // root folder should organize the object
        rootFolder.objects.getFolderElementByName("SomeObject").browseName.toString().should.eql("SomeObject");

        // ------------------------------------- NOW DELETE THE OBJECT
        addressSpace.deleteNode(object.nodeId);
        //---------------------------------------------------------

        // object shall not be found with a global nodeId search
        should.not.exist(addressSpace.findNode(object.nodeId));

        // object shall not be found in parent folder anymore
        references = rootFolder.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(0);

        should(rootFolder.getFolderElementByName("SomeObject")).eql(null);

    });

    it("AddressSpace#deleteNode - should remove an object and its children from the address space", function () {

        const options = {
            organizedBy: "ObjectsFolder",
            browseName: "SomeObject"
        };
        const object = addressSpace.addObject(options);
        const innerVar = addressSpace.addVariable({componentOf: object, browseName: "Hello", dataType: "String"});

        // objects shall  be found with a global nodeId search
        addressSpace.findNode(object.nodeId).should.eql(object);
        addressSpace.findNode(innerVar.nodeId).should.eql(innerVar);

        let references = object.findReferences("HasComponent", true);
        findReference(references, innerVar.nodeId).length.should.eql(1);

        references = rootFolder.objects.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(1);

        //---------------------------------------------------------
        addressSpace.deleteNode(object.nodeId);
        //---------------------------------------------------------

        // object shall not be found with a global nodeId search
        should.not.exist(addressSpace.findNode(object.nodeId));
        should.not.exist(addressSpace.findNode(innerVar.nodeId));

        references = rootFolder.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(0);

    });

    it("AddressSpace#deleteNode - should remove a component of a existing object", function () {

        // give an object
        const object = addressSpace.addObject({organizedBy: "ObjectsFolder", browseName: "MyObject1"});

        // let's construct some properties and some components gradually, and verify that the caches
        // work as expected.
        const comp1 = addressSpace.addVariable({componentOf: object, browseName: "Component1", dataType: "String"});
        const prop1 = addressSpace.addVariable({propertyOf: object, browseName: "Property1", dataType: "String"});

        object.getComponents().length.should.eql(1);
        object.getComponents()[0].browseName.toString().should.eql("Component1");

        object.getProperties().length.should.eql(1);
        object.getProperties()[0].browseName.toString().should.eql("Property1");

        object.getChildByName("Component1").browseName.toString().should.eql("Component1");
        object.getChildByName("Property1").browseName.toString().should.eql("Property1");
        should(object.getChildByName("Component2")).eql(null);

        const comp2 = addressSpace.addVariable({componentOf: object, browseName: "Component2", dataType: "String"});
        const prop2 = addressSpace.addVariable({propertyOf: object, browseName: "Property2", dataType: "String"});

        object.getComponents().length.should.eql(2);
        object.getComponents()[0].browseName.toString().should.eql("Component1");
        object.getComponents()[1].browseName.toString().should.eql("Component2");

        object.getProperties().length.should.eql(2);
        object.getProperties()[0].browseName.toString().should.eql("Property1");
        object.getProperties()[1].browseName.toString().should.eql("Property2");

        object.getChildByName("Component1").browseName.toString().should.eql("Component1");
        object.getChildByName("Property1").browseName.toString().should.eql("Property1");
        object.getChildByName("Component2").browseName.toString().should.eql("Component2");
        object.getChildByName("Property2").browseName.toString().should.eql("Property2");

        // now lets remove Prop1
        addressSpace.deleteNode(prop1.nodeId);
        object.getProperties().length.should.eql(1);
        object.getProperties()[0].browseName.toString().should.eql("Property2");

        object.getChildByName("Component1").browseName.toString().should.eql("Component1");
        should(object.getChildByName("Property1")).eql(null);
        object.getChildByName("Component2").browseName.toString().should.eql("Component2");
        object.getChildByName("Property2").browseName.toString().should.eql("Property2");

        addressSpace.deleteNode(prop2.nodeId);
        object.getProperties().length.should.eql(0);

        object.getChildByName("Component1").browseName.toString().should.eql("Component1");
        should(object.getChildByName("Property1")).eql(null);
        object.getChildByName("Component2").browseName.toString().should.eql("Component2");
        should(object.getChildByName("Property2")).eql(null);

    });


    const makeNodeId = require("node-opcua-nodeid").makeNodeId;
    const DataTypeIds = require("node-opcua-constants").DataTypeIds;
    const DataType = require("node-opcua-variant").DataType;
    const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

    it("AddressSpace#findCorrespondingBasicDataType i=13 => DataType.String", function () {

        const dataType = addressSpace.findDataType(resolveNodeId("i=12"));
        dataType.browseName.toString().should.eql("String");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);

    });

    it("AddressSpace#findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject", function () {

        const dataType = addressSpace.findDataType(makeNodeId(DataTypeIds.BuildInfo)); // ServerStatus
        dataType.browseName.toString().should.eql("BuildInfo");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#findCorrespondingBasicDataType variation 1 - Alias", function () {
        addressSpace.findCorrespondingBasicDataType("Int32").should.eql(DataType.Int32);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 2 - nodeId as String", function () {
        addressSpace.findCorrespondingBasicDataType("i=13").should.eql(DataType.DateTime);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 3 - nodeId as NodeId", function () {
        addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#findCorrespondingBasicDataType i=852 (Enumeration ServerState) => UInt32", function () {
        addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.ServerState)).should.eql(DataType.Int32);
    });



    it(" AddressSpace#findCorrespondingBasicDataType  i=13 => DataType.String", function () {

        const dataType = addressSpace.findDataType(resolveNodeId("i=12"));
        dataType.browseName.toString().should.eql("String");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);

    });

    it("AddressSpace#findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject", function () {

        const dataType = addressSpace.findDataType(makeNodeId(DataTypeIds.BuildInfo)); // ServerStatus
        dataType.browseName.toString().should.eql("BuildInfo");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#findCorrespondingBasicDataType variation 1 - Alias", function () {
        addressSpace.findCorrespondingBasicDataType("Int32").should.eql(DataType.Int32);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 2 - nodeId as String", function () {
        addressSpace.findCorrespondingBasicDataType("i=13").should.eql(DataType.DateTime);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 3 - nodeId as NodeId", function () {
        addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
    });


    it("AddressSpace#addObject : should verify that Only Organizes References are used to relate Objects to the 'Objects' standard Object.", function () {

        //  (version 1.03) part 5 : $8.2.4
        //   Only Organizes References are used to relate Objects to the 'Objects' standard Object.
        should(function add_an_object_to_the_objects_folder_using_a_component_relation_instead_of_organizedBy() {

            addressSpace.addObject({
                browseName: "TestObject1",
                componentOf: addressSpace.rootFolder.objects
            });

        }).throwError();

        should(function add_an_object_to_the_objects_folder_using_a_property_relation_instead_of_organizedBy() {

            addressSpace.addObject({
                browseName: "TestObject2",
                propertyOf: addressSpace.rootFolder.objects
            });

        }).throwError();

    });

    it("AddressSpace#extractRootViews : it should provide a mean to extract the list of views to which the object is visible", function () {

        // by walking up the hierarchy of node until we reach either the root.objects folder => primary view is server
        // or the views folder

        const objects = addressSpace.rootFolder.objects;

        const view1 = addressSpace.addView({
            organizedBy: addressSpace.rootFolder.views,
            browseName: "View1"
        });

        const view2 = addressSpace.addView({
            organizedBy: addressSpace.rootFolder.views,
            browseName: "View2"
        });

        const view3 = addressSpace.addView({
            organizedBy: addressSpace.rootFolder.views,
            browseName: "View3"
        });

        const folder = addressSpace.addObject({
            typeDefinition: addressSpace.findObjectType("FolderObjectType"),
            organizedBy: addressSpace.rootFolder.views,
            browseName: "EngineeringViews"
        });

        const view4 = addressSpace.addView({
            organizedBy: folder,
            browseName: "View4"
        });

        const node = addressSpace.addObject({
            organizedBy: objects,
            browseName: "ParentNodeXXX"
        });

        node.addReference({referenceType: "OrganizedBy", nodeId: view1});

        node.addReference({referenceType: "OrganizedBy", nodeId: view4});

        const views = addressSpace.extractRootViews(node);

        views.length.should.eql(2);
        views[0].should.eql(view1);
        views[1].should.eql(view4);

        const AttributeIds = require("node-opcua-data-model").AttributeIds;
        view1.readAttribute(context, AttributeIds.EventNotifier).value.toString().should.eql("Variant(Scalar<UInt32>, value: 0)");
        view1.readAttribute(context, AttributeIds.ContainsNoLoops).value.toString().should.eql("Variant(Scalar<Boolean>, value: false)");
        view1.readAttribute(context, AttributeIds.BrowseName).value.value.toString().should.eql("View1");

    });

});
