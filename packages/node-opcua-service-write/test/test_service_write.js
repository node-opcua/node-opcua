"use strict";
var should = require("should");
var write_service = require("..");
var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test

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

        var wv = new write_service.WriteValue({});
        should(wv.indexRange.type.key).equal("Empty");

    });

});
describe("WriteRequest", function () {


    it("should create a default WriteRequest", function () {

        var wv = new write_service.WriteRequest({
            nodesToWrite: [{}, {}]
        });
        should(wv.nodesToWrite[0].indexRange.type.key).equal("Empty");

        encode_decode_round_trip_test(wv);

    });

});
