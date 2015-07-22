require("requirish")._(module);
var should = require("should");
var write_service = require("lib/services/write_service");
var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

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
