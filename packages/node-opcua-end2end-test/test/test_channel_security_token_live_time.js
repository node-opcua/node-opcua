"use strict";


const should = require("should");
const os = require("os");
const path = require("path");
const fs = require("fs");
const opcua = require("node-opcua");
const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;

function getFixture(file) {
    file = path.join(__dirname, "../../node-opcua-address-space/test_helpers/test_fixtures", file);
    fs.existsSync(file).should.be.eql(true);
    return file;
}
const empty_nodeset_filename = getFixture("fixture_empty_nodeset2.xml");


const debugLog = require("node-opcua-debug").make_debugLog(__filename);

let port = 4000;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing ChannelSecurityToken lifetime", function () {

    this.timeout(Math.max(100000, this._timeout));

    let server, client;
    let endpointUrl;

    beforeEach(function (done) {

        port += 1;
        server = new OPCUAServer({ port: port, nodeset_filename: empty_nodeset_filename });


        client = OPCUAClient.create({
            defaultSecureTokenLifetime: 100  // very short live time !
        });

        server.start(function () {

            // we will connect to first server end point
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            debugLog("endpointUrl", endpointUrl);
            opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

            setImmediate(done);
        });
    });

    afterEach(function (done) {

        setImmediate(function () {
            client.disconnect(function () {
                server.shutdown(function () {

                    OPCUAServer.registry.count().should.eql(0);

                    done();
                });
            });
        });

    });

    it("A secure channel should raise a event to notify its client that its token is at 75% of its liidtime", function (done) {

        client.connect(endpointUrl, function (err) {
            should(!!err).equal(false);
        });
        client._secureChannel.once("lifetime_75", function () {
            debugLog(" received lifetime_75");
            client.disconnect(function () {
                done();
            });
        });
    });

    it("A secure channel should raise a event to notify its client that a token about to expired has been renewed", function (done) {

        client.connect(endpointUrl, function (err) {
            should(!!err).equal(false);
        });
        client._secureChannel.on("security_token_renewed", function () {
            debugLog(" received security_token_renewed");
            client.disconnect(function () {
                done();
            });
        });
    });

    it("A client should periodically renew the expiring security token", async () => {

        await client.connect(endpointUrl);

        let security_token_renewed_counter = 0;
        client._secureChannel.on("security_token_renewed", function () {
            debugLog(" received security_token_renewed");
            security_token_renewed_counter += 1;
        });
        let waitingTime = 5000;
        if (os.arch() === "arm") {
            // give more time for slow raspberry to react */
            waitingTime += 8000;
        }
        await new Promise((resolve) => setTimeout(resolve, waitingTime));

        security_token_renewed_counter.should.be.greaterThan(3);

    });

});
