
var should = require("should");
var assert = require("node-opcua-assert");

var StatusCodes = require("..").StatusCodes;
var StatusCode = require("..").StatusCode;
var encodeStatusCode = require("..").encodeStatusCode;
var decodeStatusCode = require("..").decodeStatusCode;

var BinaryStream = require("node-opcua-binary-stream").BinaryStream;

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
        StatusCodes.GoodWithOverflowBit.name.should.equal("Good#InfoTypeDataValue|Overflow");
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

    it("GoodWithOverflowBit",function() {
        var statusCode2 =  StatusCodes.makeStatusCode(StatusCodes.Good,"Overflow | InfoTypeDataValue");
        statusCode2.should.eql(StatusCodes.GoodWithOverflowBit);
    });

    it("should be possible to set SemanticChanged bit on a status code",function() {

        var statusCode2 =  StatusCodes.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode2.set("SemanticChanged");
        statusCode2.value.should.eql(StatusCodes.BadNodeIdExists + 0x4000);
        statusCode2.name.should.eql("BadNodeIdExists#SemanticChanged");

    });
    it("should be possible to set the Overflow bit on a status code",function() {

        var statusCode2 =  StatusCodes.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode2.set("Overflow");
        statusCode2.value.should.eql(StatusCodes.BadNodeIdExists + 0x80);
        statusCode2.name.should.eql("BadNodeIdExists#Overflow");

    });
    it("should be possible to set the Overflow and SemanticChanged bits on a status code",function() {

        var statusCode = StatusCodes.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode.set("Overflow | SemanticChanged");


        statusCode.value.should.eql(StatusCodes.BadNodeIdExists.value + 0x80 + 0x4000);
        statusCode.name.should.eql("BadNodeIdExists#SemanticChanged|Overflow");

        statusCode.toString().should.eql("BadNodeIdExists#SemanticChanged|Overflow (0x805e4080)");
    });


    it("should be possible to encode and decode a statusCode that have a extra information bit",function() {

        var statusCode = StatusCodes.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode.set("Overflow | SemanticChanged");

        var stream = new BinaryStream(8);
        encodeStatusCode(statusCode, stream);
        stream.rewind();
        var statusCode2 = decodeStatusCode(stream);
        statusCode2.should.eql(statusCode);

        statusCode2.hasOverflowBit.should.equal(true);
        statusCode2.hasSemanticChangedBit.should.equal(true);
        statusCode2.hasStructureChangedBit.should.equal(false);
        statusCode2.should.be.instanceOf(StatusCode);

    });

    it("should be possible to create a modifiable StatusCode from a ModifiableStatusCode",function() {

        var statusCode = StatusCodes.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode.set("Overflow");
        statusCode.hasOverflowBit.should.equal(true);
        statusCode.hasSemanticChangedBit.should.equal(false);

        var statusCode2 = StatusCodes.makeStatusCode(statusCode);
        statusCode2.hasOverflowBit.should.equal(true);
        statusCode2.hasSemanticChangedBit.should.equal(false);
        statusCode2.set("SemanticChanged");
        statusCode2.hasOverflowBit.should.equal(true);
        statusCode2.hasSemanticChangedBit.should.equal(true);

        statusCode.hasOverflowBit.should.equal(true);
        statusCode.hasSemanticChangedBit.should.equal(false);

    });

    it("should fail to set a extra information bit on a standard StatusCode",function() {
        should(function() {

            var statusCode =StatusCodes.Good;

            statusCode.set("Overflow"); // << set is not defined !!!

        }).throwError();
    })

});
