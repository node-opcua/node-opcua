"use strict";
const should = require("should");

const {
    OPCUAClient,
    AttributeIds,
    makeNodeId,
    MessageSecurityMode,
    SecurityPolicy,
    TimestampsToReturn,
    VariableIds,
    MonitoringMode
} = require("node-opcua");
const { perform_operation_on_subscription_async } = require("../../test_helpers/perform_operation_on_client_session");
const securityMode = MessageSecurityMode.None;
const securityPolicy = SecurityPolicy.None;

// Use Case:
//
//     - Given a server
//     - Given a client, connected to the server
//     - Given a subscription with some monitored Item that produces DataNotification continuously
//
//     - When the TCP connection is broken
//
//     - Then the server stops sending DataNotification but keeps accumulating them, waiting for a new client connection
//       on the same session.
//
//     - Then the client tries to reconnect to the server by creating a new SecureChannel and reactivates
//       the previous session.
//
//     - and When the connection is established again
//
//     - Then the client can reestablish the subscription &  monitored item
//     - We should verify that none of the
//
module.exports = function (test) {
    function simulate_connection_lost(client) {
        const socket = client._secureChannel._transport._socket;
        socket.end();
        socket.emit("error", new Error("ECONNRESET"));
    }

    describe("Testing bug #144 - Server with Client & active subscription, connection broken , reconnection => No data Lost", function () {
        let server, client, endpointUrl;

        beforeEach(async () => {
            client = OPCUAClient.create({
                securityMode: securityMode,
                securityPolicy: securityPolicy,
                serverCertificate: null,
                endpointMustExist: false
            });
            endpointUrl = test.endpointUrl;
            server = test.server;
        });

        afterEach(async () => {
            await client.disconnect();
            client = null;
        });

        it("#144-A should 1", async () => {
            let timerId;

            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                let session_restored_Count = 0;
                session.on("session_restored", () => (session_restored_Count += 1));

                const timeout = 2000;
                let keepaliveCounter = 0;
                // subscribe to currentTime
                console.log("revised publishingInterval :", subscription.publishingInterval);
                console.log("revised lifetimeCount      :", subscription.lifetimeCount);
                console.log("revised maxKeepAliveCount  :", subscription.maxKeepAliveCount);
                console.log("started subscription       :", subscription.subscriptionId);

                subscription
                    .on("internal_error", (err) => {
                        console.log(" received internal error", err.message);
                        clearTimeout(timerId);
                    })
                    .on("keepalive", () => {
                        console.log("keepalive");
                        keepaliveCounter++;
                    });

                const nodeId = makeNodeId(VariableIds.Server_ServerStatus_CurrentTime); // "ns=0;i=2261";

                const monitoredItem = await subscription.monitor(
                    {
                        nodeId,
                        attributeId: AttributeIds.Value
                    },
                    {
                        samplingInterval: 50,
                        discardOldest: true,
                        queueSize: 1
                    },
                    TimestampsToReturn.Both,
                    MonitoringMode.Reporting
                );

                let change_count = 0;
                monitoredItem.on("changed", function (dataValue) {
                    should.exist(dataValue);
                    change_count += 1;
                });

                await new Promise((resolve) => setTimeout(resolve, timeout));

                const change_countBefore = change_count;
                console.log(
                    "change_count = ",
                    change_count,
                    "keepaliveCounter =",
                    keepaliveCounter,
                    "session_restored_Count =",
                    session_restored_Count
                );
                session_restored_Count.should.eql(0);

                // simulate a  connection break
                simulate_connection_lost(client);

                await new Promise((resolve) => setTimeout(resolve, timeout));

                console.log(
                    "change_count = ",
                    change_count,
                    "keepaliveCounter =",
                    keepaliveCounter,
                    "session_restored_Count =",
                    session_restored_Count
                );
                
                session_restored_Count.should.eql(1);
                change_countBefore.should.be.lessThan(change_count);
            });
        });
    });
};
