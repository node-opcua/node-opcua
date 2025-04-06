import sinon from "sinon";
import should from "should";
import { messageLogger } from "node-opcua-debug";
import { OPCUAClient, TimestampsToReturn } from "node-opcua-client";

const doDebug = false;
export function t(test: any) {
    describe("testing long operation detection", function () {
        it("should warning the user about long operations in monitoredItem.on('change', eventHandler)", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            const warningMessageSpyFunc = sinon.spy();
            messageLogger.on("warningMessage", warningMessageSpyFunc);
            let notificationCount = 0;

            await client.withSubscriptionAsync(
                endpointUrl,
                {
                    maxNotificationsPerPublish: 100,
                    publishingEnabled: true,
                    requestedLifetimeCount: 1000,
                    priority: 1,
                    requestedMaxKeepAliveCount: 10,
                    requestedPublishingInterval: 100
                },
                async (session, subscription) => {
                    const monitoredItem = await subscription.monitor(
                        {
                            nodeId: "ns=0;i=2258"
                        },
                        { queueSize: 1, samplingInterval: 100 },
                        TimestampsToReturn.Both
                    );

                    monitoredItem.on("changed", (dataValue: any) => {
                        notificationCount++;
                        // simulate a long blocking operation > 150 ms
                        const start = Date.now();
                        let cur = Date.now();
                        while (cur - start < 150) {
                            cur = Date.now();
                        }
                        doDebug && console.log("dataValue = ", dataValue.toString());
                    });

                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            );

            const msg = warningMessageSpyFunc
                .getCalls()
                .map((x) => x.args[0])
                .join(" ");

            msg.should.match(/.*\[NODE-OPCUA-W32\]/);

            notificationCount.should.be.greaterThan(3);
            warningMessageSpyFunc.callCount.should.eql(1, "warningLog: should only display one notification");
        });
    });
}
