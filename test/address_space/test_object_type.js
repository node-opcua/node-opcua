/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var create_minimalist_address_space_nodeset = require("../helpers/create_minimalist_address_space_nodeset");

describe("testing UAObjectType", function () {

    var addressSpace;
    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {

        before(function () {
            addressSpace = new address_space.AddressSpace();
            create_minimalist_address_space_nodeset(addressSpace);
        });
        after(function (done) {
            if (addressSpace){
                addressSpace.dispose();
                addressSpace = null;
            }
            done();
        });
    });

    it("should read Attribute IsAbstract on UAObjectType ", function () {

        var objType = new UAObjectType({
            browseName: "MyObject",
            addressSpace: addressSpace,
            isAbstract: false
        });

        var value;
        value = objType.readAttribute(AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);

    });
    it("should read Attribute IsAbstract on Abstract UAObjectType ", function () {

        var objType = new UAObjectType({
            browseName: "MyObject2",
            addressSpace: addressSpace,
            isAbstract: true
        });

        var value;
        value = objType.readAttribute(AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);


        value = objType.readAttribute(AttributeIds.NodeId);

    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType (nodeid not specified)",function() {


        var objType = addressSpace.addObjectType({
            browseName: "MyObject3",
            subtypeOf: "BaseObjectType",
            isAbstract: false
        }); 

        var obj = objType.instantiate({
            browseName: "Instance3"
        });

        obj.browseName.toString().should.eql("Instance3");

        obj.nodeId.identifierType.should.eql(NodeId.NodeIdType.NUMERIC);

    });

    it("UAObjectType#instantiate should be possible to instantiate a ObjectType and specify its nodeId)",function() {

        var objType = addressSpace.addObjectType({
            browseName: "MyObject4",
            subtypeOf: "BaseObjectType",
            isAbstract: false
        });

        var obj = objType.instantiate({
            browseName: "Instance4",
            nodeId: "ns=3;s=HelloWorld"
        });

        obj.browseName.toString().should.eql("Instance4");

        obj.nodeId.toString().should.eql("ns=3;s=HelloWorld");


        
    });

});

