import * as should from "should";

import { NodeClass } from "node-opcua-data-model";
import { Variant } from "node-opcua-variant";

import { SubscriptionDiagnosticsDataType } from "node-opcua-types";
import {
    addElement,
    AddressSpace,
    createExtObjArrayNode,
    removeElement,
    UASubscriptionDiagnostics,
    DTSubscriptionDiagnostics,
    UADataType,
    UAVariable
} from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Extension Object Array Node (or Complex Variable)", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should create a Variable that exposes an array of ExtensionObject of a specific type", async () => {
        // given a address space
        // give a DataType

        const rootFolder = addressSpace.rootFolder;

        const arr = createExtObjArrayNode<SubscriptionDiagnosticsDataType>(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest1",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            variableType: "SubscriptionDiagnosticsType"
        });

        addressSpace.findNode(arr.dataType)!.nodeClass.should.eql(NodeClass.DataType);

        const expectedType = addressSpace.findVariableType("SubscriptionDiagnosticsArrayType")!;
        arr.typeDefinition
            .toString()
            .should.eql(expectedType.nodeId.toString(), "should have typeDefinition SubscriptionDiagnosticsArrayType");

        const dv = arr.readValue();
        should(dv.value.value).eql([]);
        dv.value.value.should.be.instanceOf(Array);
        dv.value.value.length.should.eql(0, "expecting no element in array");

        const counter = 10;

        // now, let's add a new extension  object into the array
        const options = {
            subscriptionId: counter
        };
        const elementNode = addElement(options, arr) as UASubscriptionDiagnostics<DTSubscriptionDiagnostics>;

        arr.readValue().value.value.length.should.eql(1, "expecting a new element in array");

        elementNode.browseName.toString().should.eql("1:10");
        elementNode.subscriptionId.nodeClass.should.eql(NodeClass.Variable);
        elementNode.readValue().value.value.should.be.instanceOf(SubscriptionDiagnosticsDataType);
        elementNode.readValue().value.should.be.instanceOf(Variant);

        // verify that object is now bond, by modifying a value of a property of the underlying data structure
        // and checking that the corresponding node has changed.

        // we read a copy of the element at pos [0]
        const obj = arr.readValue().value.value[0];
        obj.maxLifetimeCount = 12345;

        // changing this element should not change the underlying value
        elementNode.maxLifetimeCount.readValue().value.value.should.eql(0);
        elementNode.readValue().value.value.maxLifetimeCount.should.eql(0);

        // we change the value itself
        arr.$$extensionObjectArray[0].maxLifetimeCount = 12345;

        arr.readValue().value.value[0].maxLifetimeCount.should.eql(12345, "element to be reflected in the array");

        elementNode.maxLifetimeCount.readValue().value.value.should.eql(12345);
        elementNode.readValue().value.value.maxLifetimeCount.should.eql(12345);
    });

    it("should be possible to add more than one element in the Extension Object variable node", () => {
        const rootFolder = addressSpace.rootFolder;

        const arr = createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest2",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            variableType: "SubscriptionDiagnosticsType"
        });

        const elVar1 = addElement({ subscriptionId: 1000 }, arr);
        const elVar2 = addElement({ subscriptionId: 1001 }, arr);
        const elVar3 = addElement({ subscriptionId: 1002 }, arr);

        elVar1.browseName.toString().should.eql("1:1000");
        elVar2.browseName.toString().should.eql("1:1001");
        elVar3.browseName.toString().should.eql("1:1002");

        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");
    });
    it("should be possible to remove some element in the Extension Object variable node", () => {
        const rootFolder = addressSpace.rootFolder;

        const arr = createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest3",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            variableType: "SubscriptionDiagnosticsType"
        });

        const elVar1 = addElement({ subscriptionId: 1000 }, arr);
        const elVar2 = addElement({ subscriptionId: 1001 }, arr);
        const elVar3 = addElement({ subscriptionId: 1002 }, arr);
        const elVar4 = addElement({ subscriptionId: 1003 }, arr);
        arr.readValue().value.value.length.should.eql(4, "expecting 4 elements in array");

        arr.getComponentByName("1000")!.should.eql(elVar1);
        arr.getComponentByName("1001")!.should.eql(elVar2);
        arr.getComponentByName("1002")!.should.eql(elVar3);
        arr.getComponentByName("1003")!.should.eql(elVar4);

        removeElement(arr, elVar1);
        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1002);
        arr.readValue().value.value[2].subscriptionId.should.eql(1003);

        should.exist(arr.getComponentByName("1002"));

        removeElement(arr, 1); // at pos 1

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1003);

        should.not.exist(arr.getComponentByName("1002"));
        should.not.exist(arr.getComponentByName("1000"));
    });

    it("should be possible to add an element in  the Extension array that already exists ", () => {
        const rootFolder = addressSpace.rootFolder;

        const arr = createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            variableType: "SubscriptionDiagnosticsType"
        });
        arr.readValue().value.value.length.should.eql(0);
        // create an element

        const subscriptionDiagnosticsType = addressSpace.findVariableType("SubscriptionDiagnosticsType")!;
        should.exist(subscriptionDiagnosticsType);

        const item1 = subscriptionDiagnosticsType.instantiate({
            browseName: "testing",
            componentOf: addressSpace.rootFolder
        }) as UASubscriptionDiagnostics<DTSubscriptionDiagnostics>;

        should.exist(item1.$extensionObject, "item1 must expose an extension object");
        should.exist(item1.$extensionObject.enableCount, "item1 must expose an extension object");
        item1.$extensionObject.enableCount.should.eql(0);

        // now inject this instance in the arr
        addElement(item1.$extensionObject, arr);

        // verify that object has been added to the collection
        arr.readValue().value.value.length.should.eql(1);

        // verify that external object and instance in the arr represent the same instance ...
        // in order to test this, we modify the original data

        item1.$extensionObject.enableCount = 36;

        arr.readValue().value.value[0].enableCount.should.eql(36);
        item1.readValue().value.value.enableCount.should.eql(36);

        // xx console.log(arr.toString());
    });

    it("should be possible to add the same extension object into two array Variables", () => {
        const rootFolder = addressSpace.rootFolder;

        // Given 2 SubscriptionDiagnosticArray ( A & B)
        const arrA = createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArray_A",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            variableType: "SubscriptionDiagnosticsType"
        });
        arrA.readValue().value.value.length.should.eql(0);

        const arrB = createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArray_B",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            indexPropertyName: "subscriptionId",
            variableType: "SubscriptionDiagnosticsType"
        });
        arrB.readValue().value.value.length.should.eql(0);

        // Given an extension object variable ( with no parent)
        const subscriptionDiagnosticsType = addressSpace.findVariableType("SubscriptionDiagnosticsType")!;
        should.exist(subscriptionDiagnosticsType);

        const extObj = new SubscriptionDiagnosticsDataType({
            enableCount: 7,
            subscriptionId: 1123455
        });

        const browseName = arrA.$$getElementBrowseName(extObj);

        const item1 = subscriptionDiagnosticsType.instantiate({
            browseName,
            extensionObject: extObj
        }) as UASubscriptionDiagnostics<DTSubscriptionDiagnostics>;

        should.exist(item1.$extensionObject, "item1 must expose an extension object");
        should.exist(item1.$extensionObject.enableCount, "item1 must expose an extension object");
        item1.$extensionObject.enableCount.should.eql(7);
        item1.$extensionObject.subscriptionId.should.eql(1123455);

        item1.$extensionObject.enableCount = 13;

        // Then I should be able to add it to the first array
        const elemA = addElement(item1, arrA);
        // verify that object has been added to the collection
        arrA.readValue().value.value.length.should.eql(1);

        // Then I should be able to add it to the second array
        const elemB = addElement(item1, arrB);
        // verify that object has been added to the collection
        arrB.readValue().value.value.length.should.eql(1);

        // ---------------------------------------------------------------------
        // Lets verify that element variable share the same extension object
        // ---------------------------------------------------------------------
        item1.$extensionObject.enableCount = 42;
        item1.readValue().value.value.enableCount.should.eql(42);

        // xx console.log(arrA.toString());

        arrA.readValue().value.value[0].enableCount.should.eql(42);
        arrB.readValue().value.value[0].enableCount.should.eql(42);

        // ---------------------------------------------------------------------
        // Now remove elements from array
        // ---------------------------------------------------------------------
        elemA.should.eql(elemB);

        arrA.getComponentByName("1123455")!.browseName.toString().should.eql("1:1123455");
        arrB.getComponentByName("1123455")!.browseName.toString().should.eql("1:1123455");

        removeElement(arrA, elemA);
        arrA.readValue().value.value.length.should.eql(0);
        arrB.readValue().value.value.length.should.eql(1);
        should.not.exist(arrA.getComponentByName("1123455"));
        arrB.getComponentByName("1123455")!.browseName.toString().should.eql("1:1123455");

        removeElement(arrB, elemB);
        arrA.readValue().value.value.length.should.eql(0);
        arrB.readValue().value.value.length.should.eql(0);
        should.not.exist(arrA.getComponentByName("1123455"));
        should.not.exist(arrB.getComponentByName("1123455"));
    });
});
