"use strict";
require("requirish")._(module);

var should = require("should");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UADataType = require("lib/address_space/data_type").UADataType;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var address_space = require("lib/address_space/address_space");
var get_mini_address_space = require("test/fixtures/fixture_mininodeset_address_space").get_mini_address_space;

describe("testing UADataype -  Attribute", function () {

    var the_address_space;
    before(function (done) {
        get_mini_address_space(function (err, data) {
            the_address_space = data;
            the_address_space.should.be.instanceOf(address_space.AddressSpace);
            done();
        });
    });


    it("UADataType#readAttribute", function () {

        var dataType = new UADataType({
            browseName:  "MyDataType",
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
    it("UADataType#isSubtypeOf", function () {
        // Number
        //   +--> Double
        //   +--> Float
        //   +--> Integer
        //           +-> Int16
        //           +-> Int32
        var number_dt = the_address_space.findDataType("Number");


        var double_dt = the_address_space.findDataType("Double");
        var float_dt = the_address_space.findDataType("Float");
        var integer_dt = the_address_space.findDataType("Integer");
        var int16_dt = the_address_space.findDataType("Int16");

        (typeof int16_dt).should.equal("object");
        (typeof integer_dt).should.equal("object");
        (typeof float_dt).should.equal("object");
        (typeof double_dt).should.equal("object");
        (typeof number_dt).should.equal("object");

        number_dt.isSubtypeOf(double_dt).should.eql(false);
        int16_dt.isSubtypeOf(integer_dt).should.eql(true);
        int16_dt.isSubtypeOf(number_dt).should.eql(true);
        int16_dt.isSubtypeOf(float_dt).should.eql(false);
        int16_dt.isSubtypeOf(int16_dt).should.eql(true);
    });


});
