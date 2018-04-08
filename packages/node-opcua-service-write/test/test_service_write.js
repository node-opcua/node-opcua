"use strict";
const should = require("should");
const write_service = require("..");
const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

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

        const wv = new write_service.WriteValue({});
        should(wv.indexRange.type.key).equal("Empty");

    });

});
describe("WriteRequest", function () {


    it("should create a default WriteRequest", function () {

        const wv = new write_service.WriteRequest({
            nodesToWrite: [{}, {}]
        });
        should(wv.nodesToWrite[0].indexRange.type.key).equal("Empty");

        encode_decode_round_trip_test(wv);

    });

});
