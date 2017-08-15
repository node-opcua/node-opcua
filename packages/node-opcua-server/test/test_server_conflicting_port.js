"use strict";
require("should");
var empty_nodeset_filename = require("node-opcua-address-space/test_helpers/get_mini_address_space").empty_nodeset_filename;

var OPCUAServer = require("..").OPCUAServer;

var resourceLeakDetector = require("node-opcua-test-helpers/src/resource_leak_detector").resourceLeakDetector;

describe("testing 2 servers on same port ", function () {

    var server1 = new OPCUAServer({port: 12345, nodeset_filename: empty_nodeset_filename});

    before(function (done) {
        resourceLeakDetector.start();
        server1.start(function (err) {
            done(err);
        });
    });
    after(function (done) {
        server1.shutdown(function (err) {
            resourceLeakDetector.stop();
            done(err);
        });
    });
    it("should fail to start a second server on a busy port ", function (done) {

        var server2 = new OPCUAServer({port: 12345, nodeset_filename: empty_nodeset_filename});
        server2.start(function (err) {
            err.should.be.instanceOf(Error);
            done();
        });
    });
});
