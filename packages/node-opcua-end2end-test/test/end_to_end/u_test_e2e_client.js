"use strict";
const should = require("should");
const sinon = require("sinon");
const { OPCUAClient } = require("node-opcua");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function(test) {
    describe("Testing Client Connection ", function() {
        it("it should raise an error if connect is called with an empty endpoint", async () => {
            const client = OPCUAClient.create({});

            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            const empty_endpoint = "";
            let _err;
            try {
                await client.connect(empty_endpoint);
            } catch (err) {
                _err = err;
            }
            should.exist(_err, "expecting an error here");
            _err.message.should.match("Invalid endpoint");
            closeSpy.callCount.should.eql(0);

        });
        it("it should raise an error if connect is called with an invalid endpoint", async () => {
            const client = OPCUAClient.create({ connectionStrategy: { maxRetry: 0 } });
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            async function test() {
                try {
                    await client.connect("invalid-proto://test-host");
                } catch (err) {
                    console.log(err.message);
                    throw err;
                }
            }
            test().should.be.rejectedWith(/The connection has been rejected/);
            closeSpy.callCount.should.eql(0);
        });

        it("it should raise an error when connect is called while client is already connected", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            await client.connect(test.endpointUrl);
            closeSpy.callCount.should.eql(0);

            let _err;
            try {
                await client.connect(test.endpointUrl);
            } catch (err) {
                _err = err;
            } finally {
                closeSpy.callCount.should.eql(0);
                await client.disconnect();
            }
            should.exist(_err, " ");
            _err.message.should.match(/invalid internal state = connected/);
            closeSpy.callCount.should.eql(1);
        });
        it("it should raise an error when connect is called while client is currently connecting", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            const p1 = client.connect(test.endpointUrl);

            let _err;
            try {
                await client.connect(test.endpointUrl);
            } catch (err) {
                _err = err;
            } finally {
                await p1;
                closeSpy.callCount.should.eql(0);
                await client.disconnect();
                closeSpy.callCount.should.eql(1);

            }
            should.exist(_err, " ");
            _err.message.should.match(/invalid internal state = connecting/);
            closeSpy.callCount.should.eql(1);
        });
        it("it should not raise an error if disconnect is called when client is not connected", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);
            await client.disconnect();
            await client.disconnect();
            closeSpy.callCount.should.eql(0);
        });
        it("it should not raise an error if disconnect is called twice ", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            await client.connect(test.endpointUrl);

            closeSpy.callCount.should.eql(0);

            const p1 = client.disconnect();
            const p2 = client.disconnect();


            await p2;
            await p1;
            closeSpy.callCount.should.eql(1);
        });
        it("it should  raise an warning if sessionTimeout are not compatible with subscription parameters", async () => {

            const client = OPCUAClient.create({
                requestedSessionTimeout: 1000,
            });
            await client.connect(test.endpointUrl);
            const session = await client.createSession();


            try {
                const subscription = await session.createSubscription2({
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    requestedLifetimeCount: 100,

                    requestedMaxKeepAliveCount: 100,
                    requestedPublishingInterval: 1000,
                });

            } catch (err) {
                // [NODE-OPCUA-W09] The subscription parameters are not compatible with the session timeout
                err.message.should.match(/\[NODE-OPCUA-W09\]/);
                console.log(err.message);
            }

            await session.close();
            await client.disconnect();

        });
    });
};
