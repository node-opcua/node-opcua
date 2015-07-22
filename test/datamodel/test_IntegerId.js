require("requirish")._(module);

var AccessLevelFlag = require("lib/datamodel/access_level").AccessLevelFlag;
var should = require("should");
var factories = require("lib/misc/factories");
var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
var _ = require("underscore");


var ObjWithIntegerId = factories.registerObject("test/fixtures/schemas|ObjWithIntegerId", "tmp");


describe("Testing IntegerId", function () {

    it("should persist a IntegerId === 0", function () {

        var o = new ObjWithIntegerId({
            requestHandle: 0
        });
        o.requestHandle.should.eql(0);

        var obj_reloaded = encode_decode_round_trip_test(o);
        obj_reloaded.requestHandle.should.eql(0);

    });
    it("should persist a IntegerId !== 0", function () {

        var o = new ObjWithIntegerId({
            requestHandle: 1
        });
        o.requestHandle.should.eql(1);


        var obj_reloaded = encode_decode_round_trip_test(o);

        obj_reloaded.requestHandle.should.eql(1);


    });
});
