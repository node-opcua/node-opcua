"use strict";
require("requirish")._(module);

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UADataType = require("lib/address_space/data_type").UADataType;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");

describe("testing UADataype -  Attribute", function () {

    var the_address_space;
    before(function () {
        the_address_space = new address_space.AddressSpace();
    });

    it("UADataType#readAttribute", function () {

        var dataType = new UADataType({
            address_space: the_address_space,
            isAbstract: true
        });

        var value;

        value = dataType.readAttribute(AttributeIds.IsAbstract);
        value.statusCode.should.eql(StatusCodes.Good);
        value.value.dataType.should.eql(DataType.Boolean);
        value.value.value.should.equal(true);

        value = dataType.readAttribute(AttributeIds.UserExecutable);
        value.statusCode.should.eql(StatusCodes.BadAttributeIdInvalid);


    });
});
