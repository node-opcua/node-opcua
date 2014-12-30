/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");

describe("testing ObjectType",function() {

    var the_address_space;
    before(function() {
        the_address_space = new address_space.AddressSpace();
    });

    it("should read Attribute UserExecutable & Executable on Method ",function() {

        var objType = new Method({
            address_space:the_address_space,
            userExecutable: false,
            executable: true
        });

        var value;
        value = objType.readAttribute(AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
        //xx value.value.dataType.should.eql(DataType.Boolean);
        //xx value.value.value.should.equal(false);

        value = objType.readAttribute(AttributeIds.Executable);
        value.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);
        //xx value.value.dataType.should.eql(DataType.Boolean);
        //xx value.value.value.should.equal(true);

    });


});

