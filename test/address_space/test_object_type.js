/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var ObjectType = require("lib/address_space/objectType").ObjectType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");

describe("testing ObjectType",function() {

    var the_address_space;
    before(function() {
        the_address_space = new address_space.AddressSpace();
    });

    it("should read Attribute IsAbstract on ObjectType ",function() {

        var objType = new ObjectType({
            browseName: "MyObject",
            address_space:the_address_space,
            isAbstract: false
        });

        var value;
        value = objType.readAttribute(AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(false);

    });
    it("should read Attribute IsAbstract on Abstract ObjectType ",function() {

        var objType = new ObjectType({
            browseName: "MyObject2",
            address_space:the_address_space,
            isAbstract: true
        });

        var value;
        value = objType.readAttribute(AttributeIds.IsAbstract);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.value.should.equal(true);


        value = objType.readAttribute(AttributeIds.NodeId);

    });



});

