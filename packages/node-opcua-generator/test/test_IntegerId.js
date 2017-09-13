"use strict";
var should = require("should");

var generator = require("..");
var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test
var _ = require("underscore");


var path = require("path");
var tmpfolder  = path.join(__dirname,"../_test_generated");
var ObjWithIntegerId = generator.registerObject(path.join(__dirname,"./schemas")+"|ObjWithIntegerId", tmpfolder);


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
