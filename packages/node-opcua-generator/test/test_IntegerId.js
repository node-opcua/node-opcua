"use strict";
const should = require("should");

const generator = require("..");
const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers").encode_decode_round_trip_test;

const path = require("path");
const tmpfolder = path.join(__dirname, "../_test_generated");

function initialize() {
    const ObjWithIntegerId = generator.registerObject(path.join(__dirname, "./schemas") + "|ObjWithIntegerId", tmpfolder);
}


xdescribe("Testing IntegerId", function() {

    it("should persist a IntegerId === 0", function() {

        const o = new ObjWithIntegerId({
            requestHandle: 0
        });
        o.requestHandle.should.eql(0);

        const obj_reloaded = encode_decode_round_trip_test(o);
        obj_reloaded.requestHandle.should.eql(0);

    });
    it("should persist a IntegerId !== 0", function() {

        const o = new ObjWithIntegerId({
            requestHandle: 1
        });
        o.requestHandle.should.eql(1);

        const obj_reloaded = encode_decode_round_trip_test(o);
        obj_reloaded.requestHandle.should.eql(1);


    });
});
