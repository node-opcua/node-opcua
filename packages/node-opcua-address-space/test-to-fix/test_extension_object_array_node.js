/* global describe,it,before*/

var should = require("should");

var UADataType = require("../src/ua_data_type").UADataType;
var UAVariable = require("../src/ua_variable").UAVariable;
var Variant = require("node-opcua-variant").Variant;

var get_mini_address_space = require("../test_helpers/get_mini_address_space").get_mini_address_space;

var SubscriptionDiagnostics = require("../_generated_/_auto_generated_SubscriptionDiagnostics").SubscriptionDiagnostics;

var eoan = require("../src/extension_object_array_node");

describe("Extension Object Array Node (or Complex Variable)",function() {


    var addressSpace;
    require("node-opcua-test-helpers/src/resource_leak_detector").installResourceLeakDetector(true,function() {
        before(function (done) {
            get_mini_address_space(function (err,__addressSpace__) {
                addressSpace =__addressSpace__;
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
    });


    it("should create a Variable that expose an array of ExtensionObject of a specific type",function(done) {

        // given a address space
        // give a DataType

        var rootFolder = addressSpace.findNode("RootFolder");


        var arr = eoan.createExtObjArrayNode(rootFolder,{
            browseName:          "SubscriptionDiagnosticArrayForTest1",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType:        "SubscriptionDiagnosticsType",
            indexPropertyName:   "subscriptionId"
        });


        addressSpace.findNode(arr.dataType).should.be.instanceOf(UADataType);
        var expectedType = addressSpace.findVariableType("SubscriptionDiagnosticsArrayType");
        arr.typeDefinition.toString().should.eql(expectedType.nodeId.toString());

        var dv  = arr.readValue();
        should(dv.value.value).eql([]);
        dv.value.value.should.be.instanceOf(Array);
        dv.value.value.length.should.eql(0);

        var counter = 10;
        // now add a new object
        var options  = {
            subscriptionId: counter
        };


        arr.readValue().value.value.length.should.eql(0, "expecting no element in array");


        var elVar = eoan.addElement(options,arr);


        arr.readValue().value.value.length.should.eql(1, "expecting a new element in array");
        elVar.browseName.toString().should.eql("10");
        elVar.subscriptionId.should.be.instanceOf(UAVariable);
        elVar.readValue().value.value.should.be.instanceOf(SubscriptionDiagnostics);
        elVar.readValue().value.should.be.instanceOf(Variant);


        // verify that object is now bond, by modifying a value of a property of  the underlying data structure
        // and checking that the corresponding node has changed.
        var obj = arr.readValue().value.value[0];
        obj.maxLifetimeCount = 12345;

        elVar.maxLifetimeCount.readValue().value.value.should.eql(12345);
        elVar.readValue().value.value.maxLifetimeCount.should.eql(12345);

        done();

    });

    it("should be possible to add more than one element in the Extension Object variable node",function() {

        var rootFolder = addressSpace.findNode("RootFolder");

        var arr = eoan.createExtObjArrayNode(rootFolder,{
            browseName:          "SubscriptionDiagnosticArrayForTest2",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType:        "SubscriptionDiagnosticsType",
            indexPropertyName:   "subscriptionId"
        });

        var elVar1 = eoan.addElement({subscriptionId: 1000},arr);
        var elVar2 = eoan.addElement({subscriptionId: 1001},arr);
        var elVar3 = eoan.addElement({subscriptionId: 1002},arr);

        elVar1.browseName.toString().should.eql("1000");
        elVar2.browseName.toString().should.eql("1001");
        elVar3.browseName.toString().should.eql("1002");

        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

    });
    it("should be possible to remove some element in the Extension Object variable node",function() {

        var rootFolder = addressSpace.findNode("RootFolder");

        var arr = eoan.createExtObjArrayNode(rootFolder,{
            browseName:          "SubscriptionDiagnosticArrayForTest3",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType:        "SubscriptionDiagnosticsType",
            indexPropertyName:   "subscriptionId"
        });

        var elVar1 = eoan.addElement({subscriptionId: 1000},arr);
        var elVar2 = eoan.addElement({subscriptionId: 1001},arr);
        var elVar3 = eoan.addElement({subscriptionId: 1002},arr);
        var elVar4 = eoan.addElement({subscriptionId: 1003},arr);
        arr.readValue().value.value.length.should.eql(4, "expecting 4 elements in array");


        eoan.removeElement(arr,elVar1);
        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1002);
        arr.readValue().value.value[2].subscriptionId.should.eql(1003);

        should.exist(arr.getComponentByName("1002"));

        eoan.removeElement(arr,1); // at pos 1

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1003);

        should.not.exist(arr.getComponentByName("1002"));
        should.not.exist(arr.getComponentByName("1000"));

    });

});
