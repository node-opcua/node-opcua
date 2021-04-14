// tslint:disable:max-line-length
import { assert } from "node-opcua-assert";
import { DataTypeIds } from "node-opcua-constants";
import { BrowseDirection } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { makeNodeId } from "node-opcua-nodeid";
import { resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import * as should from "should";

import { AddressSpace, Namespace, SessionContext, UAReference } from "..";
import { getMiniAddressSpace } from "../testHelpers";

function findReference(references: UAReference[], nodeId: NodeId): UAReference[] {
    assert(nodeId instanceof NodeId);
    return references.filter((r: UAReference) => r.nodeId.toString() === nodeId.toString());
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing address space", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        addressSpace.getNamespaceArray().length.should.eql(2);
        namespace = addressSpace.getOwnNamespace();
        namespace.index.should.eql(1);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("BaseNode#findReferencesEx - should find HierarchicalReferences", () => {
        const object = namespace.addObject({
            browseName: "ChildObject",
            organizedBy: "RootFolder"
        });

        object
            .findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse)
            .length.should.eql(1, "Object must be child of one parent");

        object
            .findReferencesEx("HierarchicalReferences", BrowseDirection.Forward)
            .length.should.eql(0, "Object must not have children yet");

        const comp1 = namespace.addVariable({
            browseName: "Component1",
            componentOf: object,
            dataType: "String"
        });
        object
            .findReferencesEx("HierarchicalReferences", BrowseDirection.Forward)
            .length.should.eql(1, "Object must now have one child");

        object.findReferencesEx("HasChild", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");
        // xx object.findReferencesEx("ChildOf",true).length.should.eql(1,"Object must now have one child");

        object.findReferencesEx("Aggregates", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");

        object.findReferencesEx("HasComponent", BrowseDirection.Forward).length.should.eql(1, "Object must now have one child");

        object.findReferencesEx("HasProperty", BrowseDirection.Forward).length.should.eql(0, "Object must now have one child");

        object.findReferencesEx("Organizes", BrowseDirection.Forward).length.should.eql(0, "Object must now have one child");
    });

    it("AddressSpace#deleteNode - should remove an object from the address space", () => {
        const options = {
            browseName: "SomeObject",
            organizedBy: "ObjectsFolder"
        };

        const object = namespace.addObject(options);

        // object shall be found with a global nodeId search
        addressSpace.findNode(object.nodeId)!.should.eql(object);

        const rootFolder = addressSpace.rootFolder;
        // object shall be found in parent folder
        let references = rootFolder.objects.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(1);

        // root folder should organize the object
        rootFolder.objects.getFolderElementByName("SomeObject")!.browseName.toString().should.eql("1:SomeObject");

        // ------------------------------------- NOW DELETE THE OBJECT
        addressSpace.deleteNode(object.nodeId);
        // ---------------------------------------------------------

        // object shall not be found with a global nodeId search
        should.not.exist(addressSpace.findNode(object.nodeId));

        // object shall not be found in parent folder anymore
        references = rootFolder.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(0);

        should(rootFolder.getFolderElementByName("SomeObject")).eql(null);
    });

    it("AddressSpace#deleteNode - should remove an object and its children from the address space", () => {
        const options = {
            browseName: "SomeObject",
            organizedBy: "ObjectsFolder"
        };
        const object = namespace.addObject(options);
        const innerVar = namespace.addVariable({ componentOf: object, browseName: "Hello", dataType: "String" });

        // objects shall  be found with a global nodeId search
        addressSpace.findNode(object.nodeId)!.should.eql(object);
        addressSpace.findNode(innerVar.nodeId)!.should.eql(innerVar);

        let references = object.findReferences("HasComponent", true);
        findReference(references, innerVar.nodeId).length.should.eql(1);

        const rootFolder = addressSpace.rootFolder;
        references = rootFolder.objects.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(1);

        // ---------------------------------------------------------
        addressSpace.deleteNode(object.nodeId);
        // ---------------------------------------------------------

        // object shall not be found with a global nodeId search
        should.not.exist(addressSpace.findNode(object.nodeId));
        should.not.exist(addressSpace.findNode(innerVar.nodeId));

        references = rootFolder.findReferences("Organizes", true);
        findReference(references, object.nodeId).length.should.eql(0);
    });

    it("AddressSpace#deleteNode - should remove a component of a existing object", () => {
        // give an object
        const object = namespace.addObject({ organizedBy: "ObjectsFolder", browseName: "MyObject1" });

        // let's construct some properties and some components gradually, and verify that the caches
        // work as expected.
        const comp1 = namespace.addVariable({ componentOf: object, browseName: "Component1", dataType: "String" });
        const prop1 = namespace.addVariable({ propertyOf: object, browseName: "Property1", dataType: "String" });

        object.getComponents().length.should.eql(1);
        object.getComponents()[0].browseName.toString().should.eql("1:Component1");

        object.getProperties().length.should.eql(1);
        object.getProperties()[0].browseName.toString().should.eql("1:Property1");

        object.getChildByName("Component1")!.browseName.toString().should.eql("1:Component1");
        object.getChildByName("Property1")!.browseName.toString().should.eql("1:Property1");
        should(object.getChildByName("Component2")).eql(null);

        const comp2 = namespace.addVariable({ componentOf: object, browseName: "Component2", dataType: "String" });
        const prop2 = namespace.addVariable({ propertyOf: object, browseName: "Property2", dataType: "String" });

        object.getComponents().length.should.eql(2);
        object.getComponents()[0].browseName.toString().should.eql("1:Component1");
        object.getComponents()[1].browseName.toString().should.eql("1:Component2");

        object.getProperties().length.should.eql(2);
        object.getProperties()[0].browseName.toString().should.eql("1:Property1");
        object.getProperties()[1].browseName.toString().should.eql("1:Property2");

        object.getChildByName("Component1")!.browseName.toString().should.eql("1:Component1");
        object.getChildByName("Property1")!.browseName.toString().should.eql("1:Property1");
        object.getChildByName("Component2")!.browseName.toString().should.eql("1:Component2");
        object.getChildByName("Property2")!.browseName.toString().should.eql("1:Property2");

        // now lets remove Prop1
        addressSpace.deleteNode(prop1.nodeId);
        object.getProperties().length.should.eql(1);
        object.getProperties()[0].browseName.toString().should.eql("1:Property2");

        object.getChildByName("Component1")!.browseName.toString().should.eql("1:Component1");
        should(object.getChildByName("Property1")).eql(null);
        object.getChildByName("Component2")!.browseName.toString().should.eql("1:Component2");
        object.getChildByName("Property2")!.browseName.toString().should.eql("1:Property2");

        addressSpace.deleteNode(prop2.nodeId);
        object.getProperties().length.should.eql(0);

        object.getChildByName("Component1")!.browseName.toString().should.eql("1:Component1");
        should(object.getChildByName("Property1")).eql(null);
        object.getChildByName("Component2")!.browseName.toString().should.eql("1:Component2");
        should(object.getChildByName("Property2")).eql(null);
    });

    it("AddressSpace#findCorrespondingBasicDataType i=13 => DataType.String", () => {
        const dataType = addressSpace.findDataType(resolveNodeId("i=12"))!;
        dataType.browseName.toString().should.eql("String");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);
    });

    it("AddressSpace#findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject", () => {
        const dataType = addressSpace.findDataType(makeNodeId(DataTypeIds.BuildInfo))!; // ServerStatus
        dataType.browseName.toString().should.eql("BuildInfo");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#findCorrespondingBasicDataType variation 1 - Alias", () => {
        addressSpace.findCorrespondingBasicDataType("Int32").should.eql(DataType.Int32);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 2 - nodeId as String", () => {
        addressSpace.findCorrespondingBasicDataType("i=13").should.eql(DataType.DateTime);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 3 - nodeId as NodeId", () => {
        addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#findCorrespondingBasicDataType i=852 (Enumeration ServerState) => UInt32", () => {
        addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.ServerState)).should.eql(DataType.Int32);
    });

    it(" AddressSpace#findCorrespondingBasicDataType  i=13 => DataType.String", () => {
        const dataType = addressSpace.findDataType(resolveNodeId("i=12"))!;
        dataType.browseName.toString().should.eql("String");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.String);
    });

    it("AddressSpace#findCorrespondingBasicDataType i=338 => BuildInfo => DataType.ExtensionObject", () => {
        const dataType = addressSpace.findDataType(makeNodeId(DataTypeIds.BuildInfo))!; // ServerStatus
        dataType.browseName.toString().should.eql("BuildInfo");
        addressSpace.findCorrespondingBasicDataType(dataType).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#findCorrespondingBasicDataType variation 1 - Alias", () => {
        addressSpace.findCorrespondingBasicDataType("Int32")!.should.eql(DataType.Int32);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 2 - nodeId as String", () => {
        addressSpace.findCorrespondingBasicDataType("i=13")!.should.eql(DataType.DateTime);
    });
    it("AddressSpace#findCorrespondingBasicDataType variation 3 - nodeId as NodeId", () => {
        addressSpace.findCorrespondingBasicDataType(makeNodeId(DataTypeIds.BuildInfo)).should.eql(DataType.ExtensionObject);
    });

    it("AddressSpace#addObject : should verify that Only Organizes References are used to relate Objects to the 'Objects' standard Object.", () => {
        //  (version 1.03) part 5 : $8.2.4
        //   Only Organizes References are used to relate Objects to the 'Objects' standard Object.
        should(function add_an_object_to_the_objects_folder_using_a_component_relation_instead_of_organizedBy() {
            namespace.addObject({
                browseName: "TestObject1",
                componentOf: addressSpace.rootFolder.objects
            });
        }).throwError();

        should(function add_an_object_to_the_objects_folder_using_a_property_relation_instead_of_organizedBy() {
            namespace.addObject({
                browseName: "TestObject2",
                propertyOf: addressSpace.rootFolder.objects
            });
        }).throwError();
    });

    it("AddressSpace#extractRootViews : it should provide a mean to extract the list of views to which the object is visible", () => {
        // by walking up the hierarchy of node until we reach either the root.objects folder => primary view is server
        // or the views folder

        const objects = addressSpace.rootFolder.objects;

        const view1 = namespace.addView({
            browseName: "View1",
            organizedBy: addressSpace.rootFolder.views
        });

        const view2 = namespace.addView({
            browseName: "View2",
            organizedBy: addressSpace.rootFolder.views
        });

        const view3 = namespace.addView({
            browseName: "View3",
            organizedBy: addressSpace.rootFolder.views
        });

        const folder = namespace.addObject({
            browseName: "EngineeringViews",
            organizedBy: addressSpace.rootFolder.views,
            typeDefinition: addressSpace.findObjectType("FolderObjectType")!
        });

        const view4 = namespace.addView({
            browseName: "View4",
            organizedBy: folder
        });

        const node = namespace.addObject({
            browseName: "View4",
            organizedBy: objects
        });

        node.addReference({ referenceType: "OrganizedBy", nodeId: view1 });

        node.addReference({ referenceType: "OrganizedBy", nodeId: view4 });

        const views = addressSpace.extractRootViews(node);

        views.length.should.eql(2);
        views[0].should.eql(view1);
        views[1].should.eql(view4);

        view1.readAttribute(null, AttributeIds.EventNotifier).value.toString().should.eql("Variant(Scalar<UInt32>, value: 0)");
        view1
            .readAttribute(null, AttributeIds.ContainsNoLoops)
            .value.toString()
            .should.eql("Variant(Scalar<Boolean>, value: false)");
        view1.readAttribute(null, AttributeIds.BrowseName).value.value.toString().should.eql("1:View1");
    });
});
