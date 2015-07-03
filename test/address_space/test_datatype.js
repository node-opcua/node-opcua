"use strict";
require("requirish")._(module);

var should = require("should");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UADataType = require("lib/address_space/ua_data_type").UADataType;
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
    describe("UADataType#isSupertypeOf", function () {


        var number_dt,double_dt,float_dt,integer_dt,int16_dt,uint32_dt,duration_dt,uinteger_dt,uint64_dt,int64_dt;
        before(function() {
            // see table 120 OPCUA Spec part 5
            // BaseDataType   (i=24)
            //   +-->String   (i=12)
            //   +-->DateTime (i=13)
            //   +-->Guid     (i=14)
            //   +-->Number (i=26)
            //        +--> Double(i=11)
            //        +--> Float (i=10)
            //        +--> Integer (i=27)
            //              +--> SByte (i=2)
            //              +--> Int16 (i=4)
            //              +--> Int32 (i=6)
            //              +--> Int64 (i=8)
            //        +--> UInteger(i=28)
            //              +--> Byte   (i=3)
            //              +--> UInt16 (i=5)
            //              +--> UInt32 (i=7)
            //              +--> UInt64 (i=9)
            number_dt = the_address_space.findDataType("Number");


            double_dt = the_address_space.findDataType("Double");
            float_dt = the_address_space.findDataType("Float");
            integer_dt = the_address_space.findDataType("Integer");
            uinteger_dt = the_address_space.findDataType("UInteger");
            int16_dt = the_address_space.findDataType("Int16");
            uint32_dt = the_address_space.findDataType("UInt32");
            uint64_dt = the_address_space.findDataType("UInt64");
            int64_dt = the_address_space.findDataType("Int64");
            duration_dt = the_address_space.findDataType("Duration");

            (typeof number_dt).should.equal("object");
            (typeof float_dt).should.equal("object");
            (typeof double_dt).should.equal("object");
            (typeof integer_dt).should.equal("object");
            (typeof int16_dt).should.equal("object");
            (typeof uint32_dt).should.equal("object");
            (typeof duration_dt).should.equal("object");
        });

        it("Number should not be a super type of Double",function() {
            number_dt.isSupertypeOf(double_dt).should.eql(false);
        });

        it("Double should be a super type of Number",function() {
            number_dt.isSupertypeOf(double_dt).should.eql(false);
        });

        it("Int16 should be a super type of Integer",function() {
            int16_dt.isSupertypeOf(integer_dt).should.eql(true);
        });
        it("Int16 should be a super type of Number",function() {
            int16_dt.isSupertypeOf(number_dt).should.eql(true);
        });

        it("Int16 should not be a super type of Float",function() {
            int16_dt.isSupertypeOf(float_dt).should.eql(false);
        });
        it("Int16 should be a super type of Int16",function() {
            int16_dt.isSupertypeOf(int16_dt).should.eql(true);
        });
        it("Duration should be a super type of Double",function() {
            duration_dt.isSupertypeOf(double_dt).should.eql(true);
        });

        it("Double should *not* be a super type of Duration",function() {
            double_dt.isSupertypeOf(duration_dt).should.eql(false);
        });
        it("Integer should *not* be a super type of UInt32",function() {
            integer_dt.isSupertypeOf(uint32_dt).should.eql(false);
        });
        it("UInteger should *not* be a super type of Integer",function() {
            uinteger_dt.isSupertypeOf(integer_dt).should.eql(false);
        });

        it("UInt32 should be a super type of UInteger",function() {
            uint32_dt.isSupertypeOf(uinteger_dt).should.eql(true);
        });
        it("UInt32 should *not* be a super type of Integer",function() {
            uint32_dt.isSupertypeOf(integer_dt).should.eql(false);
        });
        it("UInt32 should be a super type of UInteger",function() {
            uint32_dt.isSupertypeOf(uinteger_dt).should.eql(true);
        });

        it("UInt64 should be a super type of UInteger",function() {
            uint64_dt.isSupertypeOf(uinteger_dt).should.eql(true);
        });
        it("int64 should be a super type of Integer",function() {
            int64_dt.isSupertypeOf(integer_dt).should.eql(true);
        });

        it("UInt64 should *not* be a super type of Integer",function() {
            uint64_dt.isSupertypeOf(integer_dt).should.eql(false);
        });
        it("int64 should *not* be a super type of UInteger",function() {
            int64_dt.isSupertypeOf(uinteger_dt).should.eql(false);
        });


    });



});
