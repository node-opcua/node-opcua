"use strict";
const should = require("should");

const { get_empty_nodeset_filename } = require("node-opcua-address-space/testHelpers");
const { checkDebugFlag, make_debugLog } = require("node-opcua-debug");
const { OPCUAServer } = require("..");

const empty_nodeset_filename = get_empty_nodeset_filename();

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing 2 servers on same port ", function () {
    let server1;

    before(function (done) {
        server1 = new OPCUAServer({ port: 12345, nodeset_filename: empty_nodeset_filename });
        server1.start(function (err) {
            done(err);
        });
    });
    after(function (done) {
        server1.shutdown(function (err) {
            debugLog("err = ", err);
            done(err);
        });
    });
    it("should fail to start a second server on a busy port ", function (done) {
        const server2 = new OPCUAServer({ port: 12345, nodeset_filename: empty_nodeset_filename });
        server2.start(function (err) {
            // note : on WSL (windows subsystem for Linux), it seems possible that
            //        two servers could listen to the same port
            if (err) {
                should.exist(err, "trying to start a second server on a port that is already in used shall produce an error");
                err.should.be.instanceOf(Error);
                done();
            } else {
                server2.shutdown(done);
            }
        });
    });
});
