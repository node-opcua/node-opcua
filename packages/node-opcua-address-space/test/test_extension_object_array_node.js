/* global describe,it,before*/
"use strict";
const should = require("should");

const UADataType = require("../src/ua_data_type").UADataType;
const UAVariable = require("../src/ua_variable").UAVariable;
const Variant = require("node-opcua-variant").Variant;

const get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

const SubscriptionDiagnostics = require("node-opcua-common").SubscriptionDiagnostics;

const eoan = require("../src/extension_object_array_node");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Extension Object Array Node (or Complex Variable)", function () {


    let addressSpace;
    before(function (done) {
        get_mini_address_space(function (err, __addressSpace__) {
            addressSpace = __addressSpace__;
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


    it("should create a Variable that expose an array of ExtensionObject of a specific type", function (done) {

        // given a address space
        // give a DataType

        const rootFolder = addressSpace.findNode("RootFolder");


        const arr = eoan.createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest1",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId"
        });


        addressSpace.findNode(arr.dataType).should.be.instanceOf(UADataType);

        const expectedType = addressSpace.findVariableType("SubscriptionDiagnosticsArrayType");
        arr.typeDefinition.toString().should.eql(expectedType.nodeId.toString(),"should have typeDefinition SubscriptionDiagnosticsArrayType");

        const dv = arr.readValue();
        should(dv.value.value).eql([]);
        dv.value.value.should.be.instanceOf(Array);
        dv.value.value.length.should.eql(0,"expecting no element in array");

        const counter = 10;

        // now, let's add a new extension  objecct into the array
        const options = {
            subscriptionId: counter
        };
        const elementNode = eoan.addElement(options, arr);

        arr.readValue().value.value.length.should.eql(1, "expecting a new element in array");

        elementNode.browseName.toString().should.eql("10");
        elementNode.subscriptionId.should.be.instanceOf(UAVariable);
        elementNode.readValue().value.value.should.be.instanceOf(SubscriptionDiagnostics);
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

        done();

    });

    it("should be possible to add more than one element in the Extension Object variable node", function () {

        const rootFolder = addressSpace.findNode("RootFolder");

        const arr = eoan.createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest2",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId"
        });

        const elVar1 = eoan.addElement({subscriptionId: 1000}, arr);
        const elVar2 = eoan.addElement({subscriptionId: 1001}, arr);
        const elVar3 = eoan.addElement({subscriptionId: 1002}, arr);

        elVar1.browseName.toString().should.eql("1000");
        elVar2.browseName.toString().should.eql("1001");
        elVar3.browseName.toString().should.eql("1002");

        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

    });
    it("should be possible to remove some element in the Extension Object variable node", function () {

        const rootFolder = addressSpace.findNode("RootFolder");

        const arr = eoan.createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest3",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId"
        });

        const elVar1 = eoan.addElement({subscriptionId: 1000}, arr);
        const elVar2 = eoan.addElement({subscriptionId: 1001}, arr);
        const elVar3 = eoan.addElement({subscriptionId: 1002}, arr);
        const elVar4 = eoan.addElement({subscriptionId: 1003}, arr);
        arr.readValue().value.value.length.should.eql(4, "expecting 4 elements in array");

        arr.getComponentByName("1000").should.eql(elVar1);
        arr.getComponentByName("1001").should.eql(elVar2);
        arr.getComponentByName("1002").should.eql(elVar3);
        arr.getComponentByName("1003").should.eql(elVar4);

        eoan.removeElement(arr, elVar1);
        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1002);
        arr.readValue().value.value[2].subscriptionId.should.eql(1003);

        should.exist(arr.getComponentByName("1002"));

        eoan.removeElement(arr, 1); // at pos 1

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1003);

        should.not.exist(arr.getComponentByName("1002"));
        should.not.exist(arr.getComponentByName("1000"));

    });

    it("should be possible to add an element in  the Extension array that already exists ",function() {

        const rootFolder = addressSpace.findNode("RootFolder");

        const arr = eoan.createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArrayForTest",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId"
        });
        arr.readValue().value.value.length.should.eql(0);
        // create an element

        const SubscriptionDiagnosticsType = addressSpace.findVariableType("SubscriptionDiagnosticsType");

        should.exist(SubscriptionDiagnosticsType);

        const item1 = SubscriptionDiagnosticsType.instantiate({
            browseName:"testing",
            componentOf: addressSpace.rootFolder
        });
        should.exist(item1.$extensionObject,"item1 must expose an extension object");
        should.exist(item1.$extensionObject.enableCount,"item1 must expose an extension object");
        item1.$extensionObject.enableCount.should.eql(0);

        // now inject this instance in the arr
        eoan.addElement(item1.$extensionObject,arr);


        // verify that object has been added to the collection
        arr.readValue().value.value.length.should.eql(1);

        // verify that external object and instance in the arr represent the same instance ...
        // in order to test this, we modify the original data

        item1.$extensionObject.enableCount = 36;

        arr.readValue().value.value[0].enableCount.should.eql(36);
        item1.readValue().value.value.enableCount.should.eql(36);

       //xx console.log(arr.toString());
    });

    it("should be possible to add the same extension object into two array Variables",function() {

        const rootFolder = addressSpace.findNode("RootFolder");

        // Given 2 SubscriptionDiagnosticArray ( A & B)
        const arrA = eoan.createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArray_A",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId"
        });
        arrA.readValue().value.value.length.should.eql(0);


        const arrB = eoan.createExtObjArrayNode(rootFolder, {
            browseName: "SubscriptionDiagnosticArray_B",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId"
        });
        arrB.readValue().value.value.length.should.eql(0);


        // Given an extension object variable ( with no parent)
        const SubscriptionDiagnosticsType = addressSpace.findVariableType("SubscriptionDiagnosticsType");
        should.exist(SubscriptionDiagnosticsType);

        const extObj = new SubscriptionDiagnostics({
            subscriptionId: 1123455,
            enableCount: 7
        });

        const browseName = arrA.$$getElementBrowseName(extObj);

        const item1 = SubscriptionDiagnosticsType.instantiate({
            browseName:  browseName,
            extensionObject: extObj
        });

        should.exist(item1.$extensionObject,"item1 must expose an extension object");
        should.exist(item1.$extensionObject.enableCount,"item1 must expose an extension object");
        item1.$extensionObject.enableCount.should.eql(7);
        item1.$extensionObject.subscriptionId.should.eql(1123455);

        item1.$extensionObject.enableCount = 13;

        // Then I should be able to add it to the first array
        const elemA = eoan.addElement(item1,arrA);
        // verify that object has been added to the collection
        arrA.readValue().value.value.length.should.eql(1);


        // Then I should be able to add it to the second array
        const elemB = eoan.addElement(item1,arrB);
        // verify that object has been added to the collection
        arrB.readValue().value.value.length.should.eql(1);


        // ---------------------------------------------------------------------
        // Lets verify that element variable share the same extension object
        // ---------------------------------------------------------------------
        item1.$extensionObject.enableCount = 42;
        item1.readValue().value.value.enableCount.should.eql(42);

        //xx console.log(arrA.toString());

        arrA.readValue().value.value[0].enableCount.should.eql(42);
        arrB.readValue().value.value[0].enableCount.should.eql(42);

        // ---------------------------------------------------------------------
        // Now remove elements from array
        // ---------------------------------------------------------------------
        elemA.should.eql(elemB);

        arrA.getComponentByName("1123455").browseName.toString().should.eql("1123455");
        arrB.getComponentByName("1123455").browseName.toString().should.eql("1123455");

        eoan.removeElement(arrA,elemA);
        arrA.readValue().value.value.length.should.eql(0);
        arrB.readValue().value.value.length.should.eql(1);
        should.not.exist(arrA.getComponentByName("1123455"));
        arrB.getComponentByName("1123455").browseName.toString().should.eql("1123455");

        eoan.removeElement(arrB,elemB);
        arrA.readValue().value.value.length.should.eql(0);
        arrB.readValue().value.value.length.should.eql(0);
        should.not.exist(arrA.getComponentByName("1123455"));
        should.not.exist(arrB.getComponentByName("1123455"));
    });


});
