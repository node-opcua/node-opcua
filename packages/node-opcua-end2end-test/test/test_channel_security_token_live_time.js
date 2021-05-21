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

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 2041;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing ChannelSecurityToken lifetime", function() {
    this.timeout(Math.max(100000, this.timeout()));

    let server, client;
    let endpointUrl;

    beforeEach(function(done) {
        server = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });

        client = OPCUAClient.create({
            defaultSecureTokenLifetime: 100 // very short live time !
        });

        server.start(function() {
            // we will connect to first server end point
            endpointUrl = server.getEndpointUrl();
            debugLog("endpointUrl", endpointUrl);
            opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

            setImmediate(done);
        });
    });

    afterEach(function(done) {
        setImmediate(function() {
            client.disconnect(function() {
                server.shutdown(function() {
                    OPCUAServer.registry.count().should.eql(0);

                    done();
                });
            });
        });
    });

    it("A secure channel should raise a event to notify its client that its token is at 75% of its lifetime", function(done) {
        client.connect(endpointUrl, function(err) {
            should(!!err).equal(false);
            client._secureChannel.once("lifetime_75", function() {
                debugLog(" received lifetime_75");
                client.disconnect(function() {
                    done();
                });
            });
        });
    });

    it("A secure channel should raise a event to notify its client that a token about to expired has been renewed", function(done) {
        client.connect(endpointUrl, function(err) {
            if (err) {
                done(err);
                return;
            }
            client._secureChannel.on("security_token_renewed", function() {
                debugLog(" received security_token_renewed");
                client.disconnect(function() {
                    done();
                });
            });
        });
    });

    it("A client should periodically renew the expiring security token", async () => {
        await client.connect(endpointUrl);

        let waitingTime = (client.defaultSecureTokenLifetime + 1000) * 10;
        console.log("waiting time = ", waitingTime);

        let security_token_renewed_counter = 0;
        await new Promise((resolve, reject) => {
            const id = setTimeout(() => reject(new Error("security token not renewed")), waitingTime);

            client._secureChannel.on("security_token_renewed", function() {
                debugLog(" received security_token_renewed");
                security_token_renewed_counter += 1;
                if (security_token_renewed_counter > 3) {
                    resolve();
                    resolve = null;
                    clearTimeout(id);
                }
            });
        });

        security_token_renewed_counter.should.be.greaterThan(3);
    });
});
