/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var UAVariableType = require("lib/address_space/ua_variable_type").UAVariableType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var create_minimalist_address_space_nodeset = require("../helpers/create_minimalist_address_space_nodeset");

describe("testing UAVariableType", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        before(function () {

            addressSpace = new address_space.AddressSpace();
            create_minimalist_address_space_nodeset(addressSpace);

        });

        after(function () {
            if (addressSpace) {
                addressSpace.dispose();
            }
        });
    });

    it("should read Attribute IsAbstract on UAVariableType ", function () {

        var variableType = new UAVariableType({
            browseName: "MyVariableType1",
            addressSpace: addressSpace,
            isAbstract: false
        });

        var value;
        value = variableType.readAttribute(AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);

    });
    it("should read Attribute IsAbstract on Abstract UAVariableType ", function () {

        var variableType = new UAVariableType({
            browseName: "MyVariable2",
            addressSpace: addressSpace,
            isAbstract: true
        });

        var value;
        value = variableType.readAttribute(AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);


        value = variableType.readAttribute(AttributeIds.NodeId);

    });

    it("UAVariableType#instantiate should be possible to instantiate a VariableType (nodeid not specified)",function() {


        var variableType = addressSpace.addVariableType({
            browseName: "MyVariable3",
            subtypeOf: "BaseVariableType",
            isAbstract: false
        });

        var obj = variableType.instantiate({
            browseName: "Instance3",
            dataType: "Int32",
        });

        obj.browseName.toString().should.eql("Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);

    });

    it("UAVariableType#instantiate should be possible to instantiate a VariableType and specify its nodeId)",function() {

        var variableType = addressSpace.addVariableType({
            browseName: "MyVariable4",
            subtypeOf: "BaseVariableType",
            isAbstract: false
        });

        var obj = variableType.instantiate({
            browseName: "Instance4",
            nodeId: "ns=3;s=HelloWorld",
            dataType: "Int32",
        });

        obj.browseName.toString().should.eql("Instance4");

        obj.nodeId.toString().should.eql("ns=3;s=HelloWorld");
    });

});

