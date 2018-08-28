"use strict";
const should = require("should");
const write_service = require("..");
const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers").encode_decode_round_trip_test;
const NumericRangeType = require("node-opcua-numeric-range").NumericRangeType;
const NumericRange = require("node-opcua-numeric-range").NumericRange;
const ServerStatusDataType = require ("node-opcua-common").ServerStatusDataType;
const DataType = require("node-opcua-variant").DataType;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const WriteValue = write_service.WriteValue;
const DataValue = require("node-opcua-data-value").DataValue;

describe("Write Service",function() {


    it("should create a WriteValue",function() {
        new write_service.WriteValue({});
    });
    it("should create a WriteRequest",function() {
        new write_service.WriteRequest({});
    });
    it("should create a WriteResponse",function() {
        new write_service.WriteResponse({});
    });
});

describe("WriteValue", function () {


    it("should create a default WriteValue", function () {

        const wv = new WriteValue({});
        wv.indexRange.type.should.equal(NumericRangeType.Empty);

    });

    it ("should create a write value with a DataValue containing a Extension Object",function() {

        const dataValue = {
            value : {
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
describe("WriteRequest", function () {


    it("should create a default WriteRequest", function () {

        const wv = new write_service.WriteRequest({
            nodesToWrite: [{}, {}]
        });

        wv.nodesToWrite[0].indexRange.should.be.instanceOf(NumericRange);

        wv.nodesToWrite[0].indexRange.type.should.equal(NumericRangeType.Empty);

        encode_decode_round_trip_test(wv);

    });

});
