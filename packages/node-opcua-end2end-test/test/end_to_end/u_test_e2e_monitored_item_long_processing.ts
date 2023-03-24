import * as sinon from "sinon";
import * as should from "should";
import { messageLogger } from "node-opcua-debug";
import { OPCUAClient, TimestampsToReturn } from "node-opcua-client";

const doDebug =false;
export function t(test: any) {
    describe("testing long operation detection", function () {
        it("should warning the user about long operation", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            const spyFunc = sinon.spy();
            messageLogger.on("warningMessage", spyFunc);
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
                        // simulate a long blocking operation > 200 ms
                        const start = Date.now();
                        let cur = Date.now();
                        while (cur - start < 200) {
                            cur = Date.now();
                        }
                        doDebug && console.log("dataValue = ", dataValue.toString());
                    });

                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            );

            const msg = spyFunc
                .getCalls()
                .map((x) => x.args[0])
                .join(" ");

            msg.should.match(/.*\[NODE-OPCUA-W32\]/);

            notificationCount.should.be.greaterThan(3);
            spyFunc.callCount.should.eql(1, "should only display one notification");
        });
    });
}
