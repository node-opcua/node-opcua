/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
import AddressSpace from "lib/address_space/AddressSpace";
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var UADataType = require("lib/address_space/ua_data_type").UADataType;
var UAObject = require("lib/address_space/ua_object").UAObject;
import UAVariable from "lib/address_space/UAVariable";
var Variant = require("lib/datamodel/variant").Variant;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;



var path = require("path");

var SubscriptionDiagnostics = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/SubscriptionDiagnostics").SubscriptionDiagnostics;

var eoan = require("lib/address_space/extension_object_array_node");

describe("Extension Object Array Node (or Complex Variable)",function() {


    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {
        before(function (done) {
            addressSpace = new AddressSpace();
            var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
            require("fs").existsSync(xml_file).should.be.eql(true);
            generate_address_space(addressSpace, xml_file, function (err) {
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
