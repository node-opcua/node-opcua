require("requirish")._(module);
var assert = require("better-assert");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var StatusCode = require("lib/datamodel/opcua_status_code").StatusCode;
var encodeStatusCode = require("lib/datamodel/opcua_status_code").encodeStatusCode;
var decodeStatusCode = require("lib/datamodel/opcua_status_code").decodeStatusCode;
var should = require("should");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;

describe("testing status code manipulation", function () {

    it("should create BadNodeIdExists", function () {

        StatusCodes.BadNodeIdExists.value.should.equal(0x805e0000);
        StatusCodes.BadNodeIdExists.name.should.equal("BadNodeIdExists");

    });

    it("should create BadAttributeIdInvalid", function () {
        StatusCodes.BadAttributeIdInvalid.value.should.equal(0x80350000);
        StatusCodes.BadAttributeIdInvalid.name.should.equal("BadAttributeIdInvalid");
    });

    it("should create GoodWithOverflowBit", function () {
        StatusCodes.GoodWithOverflowBit.value.should.equal(0x480);
        StatusCodes.GoodWithOverflowBit.name.should.equal("GoodWithOverflowBit");
    });

    it("should encode and decode a status code", function () {

        var stream = new BinaryStream(8);
        var statusCode = StatusCodes.BadNodeIdExists;
        encodeStatusCode(statusCode, stream);

        stream.rewind();
        var statusCode2 = decodeStatusCode(stream);

        statusCode2.should.eql(statusCode);

    });

    it("statusCode should implement a special toString", function () {

        StatusCodes.BadAttributeIdInvalid.should.be.instanceOf(StatusCode);
        StatusCodes.BadAttributeIdInvalid.toString().should.equal("BadAttributeIdInvalid (0x80350000)");
    });

    it("should create Uncertain_InitialValue", function () {

        StatusCodes.UncertainInitialValue.value.toString(16).should.equal("40920000");
        StatusCodes.UncertainInitialValue.name.should.equal("UncertainInitialValue");

    });

});
