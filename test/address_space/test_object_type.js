/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");

describe("testing UAObjectType",function() {

    var the_address_space;
    before(function() {
        the_address_space = new address_space.AddressSpace();
    });

    it("should read Attribute IsAbstract on UAObjectType ",function() {

        var objType = new UAObjectType({
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
    it("should read Attribute IsAbstract on Abstract UAObjectType ",function() {

        var objType = new UAObjectType({
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

