"use strict";
const should = require("should");
const { WriteValue, WriteRequest, WriteResponse } = require("..");
const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");
const { NumericRange, NumericRangeType } = require("node-opcua-numeric-range");
const { ServerStatusDataType } = require("node-opcua-types");
const { DataType } = require("node-opcua-variant");
const { AttributeIds } = require("node-opcua-data-model");
const { DataValue } = require("node-opcua-data-value");

describe("Write Service", function() {


    it("should create a WriteValue", function() {
        new WriteValue({});
    });
    it("should create a WriteRequest", function() {
        new WriteRequest({});
    });
    it("should create a WriteResponse", function() {
        new WriteResponse({});
    });
});

describe("WriteValue", function() {


    it("should create a default WriteValue", function() {

        const wv = new WriteValue({});
        wv.indexRange.type.should.equal(NumericRangeType.Empty);

    });

    it("should create a write value with a DataValue containing a Extension Object", function() {

        const dataValue = {
            value: {
                dataType: DataType.ExtensionObject,
                value: new ServerStatusDataType({
                })
            }
        };
        const writeValue = new WriteValue({
            attributeId: AttributeIds.Value,
            value: dataValue
        });
        writeValue.value.should.be.instanceOf(DataValue);
        writeValue.value.value.dataType.should.eql(DataType.ExtensionObject);
        writeValue.value.value.value.should.be.instanceOf(ServerStatusDataType);

    });

});
describe("WriteRequest", function() {

    it("should create a default WriteRequest", function() {

        const wv = new WriteRequest({
            nodesToWrite: [{}, {}]
        });

        wv.nodesToWrite[0].indexRange.should.be.instanceOf(NumericRange);

        wv.nodesToWrite[0].indexRange.type.should.equal(NumericRangeType.Empty);

        encode_decode_round_trip_test(wv);

    });

});
