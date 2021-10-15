"use strict";
const should = require("should");
const { BinaryStream } = require("node-opcua-binary-stream");

const { StatusCodes, StatusCode, encodeStatusCode, decodeStatusCode, getStatusCodeFromCode, coerceStatusCode } = require("..");

describe("testing status code manipulation", () => {
    it("should create BadNodeIdExists", () => {
        StatusCodes.BadNodeIdExists.value.should.equal(0x805e0000);
        StatusCodes.BadNodeIdExists.name.should.equal("BadNodeIdExists");
    });

    it("should create BadAttributeIdInvalid", () => {
        StatusCodes.BadAttributeIdInvalid.value.should.equal(0x80350000);
        StatusCodes.BadAttributeIdInvalid.name.should.equal("BadAttributeIdInvalid");
    });

    it("should create GoodWithOverflowBit", () => {
        StatusCodes.GoodWithOverflowBit.value.should.equal(0x480);
        StatusCodes.GoodWithOverflowBit.name.should.equal("Good#InfoTypeDataValue|Overflow");
    });

    it("should encode and decode a status code", () => {
        const stream = new BinaryStream(8);
        const statusCode = StatusCodes.BadNodeIdExists;
        encodeStatusCode(statusCode, stream);
        stream.rewind();
        const statusCode2 = decodeStatusCode(stream);
        statusCode2.should.eql(statusCode);

        statusCode2.description.should.eql("The requested node id is already used by another node.");

        statusCode2.toJSON().should.eql({ value: 2153644032 });
    });

    it("statusCode should implement a special toString", () => {
        StatusCodes.BadAttributeIdInvalid.should.be.instanceOf(StatusCode);
        StatusCodes.BadAttributeIdInvalid.toString().should.equal("BadAttributeIdInvalid (0x80350000)");
    });

    it("should create Uncertain_InitialValue", () => {
        StatusCodes.UncertainInitialValue.value.toString(16).should.equal("40920000");
        StatusCodes.UncertainInitialValue.name.should.equal("UncertainInitialValue");
    });

    it("GoodWithOverflowBit", () => {
        const statusCode2 = StatusCode.makeStatusCode(StatusCodes.Good, "Overflow | InfoTypeDataValue");
        statusCode2.should.eql(StatusCodes.GoodWithOverflowBit);
    });

    it("should be possible to set SemanticChanged bit on a status code", () => {
        const statusCode2 = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode2.set("SemanticChanged");
        statusCode2.value.should.eql(StatusCodes.BadNodeIdExists.value + 0x4000);
        statusCode2.name.should.eql("BadNodeIdExists#SemanticChanged");
    });
    it("should be possible to set the Overflow bit on a status code", () => {
        const statusCode2 = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode2.set("Overflow");
        statusCode2.value.should.eql(StatusCodes.BadNodeIdExists.value + 0x80);
        statusCode2.name.should.eql("BadNodeIdExists#Overflow");
    });
    it("should be possible to set the Overflow and SemanticChanged bits on a status code", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode.set("Overflow | SemanticChanged");

        statusCode.value.should.eql(StatusCodes.BadNodeIdExists.value + 0x80 + 0x4000);
        statusCode.name.should.eql("BadNodeIdExists#SemanticChanged|Overflow");

        statusCode.toString().should.eql("BadNodeIdExists#SemanticChanged|Overflow (0x805e4080)");
    });

    it("should be possible to encode and decode a statusCode that have a extra information bit", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);
        statusCode.set("Overflow | SemanticChanged");

        const stream = new BinaryStream(8);
        encodeStatusCode(statusCode, stream);
        stream.rewind();
        const statusCode2 = decodeStatusCode(stream);
        statusCode2.should.eql(statusCode);

        statusCode2.hasOverflowBit.should.equal(true);
        statusCode2.hasSemanticChangedBit.should.equal(true);
        statusCode2.hasStructureChangedBit.should.equal(false);
        statusCode2.should.be.instanceOf(StatusCode);
    });

    it("should fail to set a extra information bit on a standard StatusCode", () => {
        should(() => {
            const statusCode = StatusCodes.Good;

            statusCode.set("Overflow"); // << set is not defined !!!
        }).throwError();
    });

    it("should convert ", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianInterpolated");
        const check = getStatusCodeFromCode(statusCode.value);

        statusCode.should.eql(check);
    });

    it("should coerce a number to a status code", () => {
        coerceStatusCode(0).should.eql(StatusCodes.Good);
        coerceStatusCode(StatusCodes.BadAggregateConfigurationRejected.value).should.eql(
            StatusCodes.BadAggregateConfigurationRejected
        );
    });

    it("should coerce a string to a status code", () => {
        coerceStatusCode("BadNotWritable").should.eql(StatusCodes.BadNotWritable);
    });

    it("should coerce a status code", () => {
        coerceStatusCode(StatusCodes.BadAggregateConfigurationRejected).should.eql(StatusCodes.BadAggregateConfigurationRejected);
    });
    it("should coerce a {value} code", () => {
        coerceStatusCode({ value: 2153644032 }).should.eql(StatusCodes.BadNodeIdExists);
    });

    it("toJSON full", () => {
        StatusCodes.BadAggregateConfigurationRejected.toJSONFull().should.eql({
            description: "The aggregate configuration is not valid for specified node.",
            name: "BadAggregateConfigurationRejected",
            value: 2161770496
        });
    });

    it("hasOverflowBit", () => {
        StatusCodes.BadAggregateConfigurationRejected.hasOverflowBit.should.eql(false);
    });
    it("hasSemanticChangedBit", () => {
        StatusCodes.BadAggregateConfigurationRejected.hasSemanticChangedBit.should.eql(false);
    });
    it("hasStructureChangedBit", () => {
        StatusCodes.BadAggregateConfigurationRejected.hasStructureChangedBit.should.eql(false);
    });

    it("equals", () => {
        StatusCodes.BadAggregateConfigurationRejected.equals(StatusCodes.BadAggregateConfigurationRejected).should.eql(true);
    });

    it("equals", () => {
        StatusCodes.BadAggregateConfigurationRejected.equals(StatusCodes.BadNoData).should.eql(false);
    });

    it("isNot", () => {
        StatusCodes.BadAggregateConfigurationRejected.isNot(StatusCodes.BadAggregateConfigurationRejected).should.eql(false);
    });

    it("isNot", () => {
        StatusCodes.BadAggregateConfigurationRejected.isNot(StatusCodes.BadNoData).should.eql(true);
    });

    it("valueOf", () => {
        StatusCodes.BadAggregateConfigurationRejected.valueOf().should.eql(2161770496);
    });
});

describe("ModifiableStatusCode", () => {
    it("should be possible to create a modifiable StatusCode from a ModifiableStatusCode", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);

        statusCode.description.should.eql("The requested node id is already used by another node.");

        statusCode.set("Overflow");
        statusCode.hasOverflowBit.should.equal(true);
        statusCode.hasSemanticChangedBit.should.equal(false);

        const statusCode2 = StatusCode.makeStatusCode(statusCode);
        statusCode2.hasOverflowBit.should.equal(true);
        statusCode2.hasSemanticChangedBit.should.equal(false);
        statusCode2.set("SemanticChanged");
        statusCode2.hasOverflowBit.should.equal(true);
        statusCode2.hasSemanticChangedBit.should.equal(true);

        statusCode.hasOverflowBit.should.equal(true);
        statusCode.hasSemanticChangedBit.should.equal(false);
    });

    it("should unset a flag by name", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);

        statusCode.set("Overflow");
        statusCode.hasOverflowBit.should.equal(true);
        statusCode.hasSemanticChangedBit.should.equal(false);

        statusCode.unset("Overflow");
        statusCode.hasOverflowBit.should.equal(false);
    });

    it("should set multiple flag by name", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.BadNodeIdExists);

        statusCode.set("Overflow | SemanticChanged");
        statusCode.hasOverflowBit.should.equal(true);
        statusCode.hasSemanticChangedBit.should.equal(true);

        statusCode.unset("Overflow");
        statusCode.hasOverflowBit.should.equal(false);
        statusCode.hasSemanticChangedBit.should.equal(true);

        statusCode.set("Overflow | SemanticChanged");
        statusCode.unset("Overflow | SemanticChanged");
        statusCode.hasOverflowBit.should.equal(false);
        statusCode.hasSemanticChangedBit.should.equal(false);
    });
    it("test with extra bits 1", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianCalculated");
        statusCode.toString().should.eql("UncertainDataSubNormal#HistorianCalculated (0x40a40001)");
    });
    it("test with extra bits 2", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianInterpolated");
        statusCode.toString().should.eql("UncertainDataSubNormal#HistorianInterpolated (0x40a40002)");
    });
    it("test with extra bits 3", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianCalculated");
        const statusCode2 = StatusCode.makeStatusCode(statusCode, "HistorianInterpolated");
        statusCode2.toString().should.eql("UncertainDataSubNormal#HistorianCalculated|HistorianInterpolated (0x40a40003)");
    });
    it("test with extra bits 4", () => {
        const statusCode = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, "HistorianCalculated");
        const mask = 0x0000ffffff;
        const extraBits = statusCode.value & mask;
        const statusCode2 = StatusCode.makeStatusCode(StatusCodes.UncertainDataSubNormal, extraBits);
        statusCode2.toString().should.eql("UncertainDataSubNormal#HistorianCalculated (0x41480001)");
    });
});
