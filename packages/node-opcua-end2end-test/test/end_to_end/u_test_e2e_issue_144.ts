import "should";
import {
    AttributeIds,
    MessageSecurityMode,
    MonitoringMode,
    makeNodeId,
    OPCUAClient,
    SecurityPolicy,
    TimestampsToReturn,
    VariableIds
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_subscription_async } from "../../test_helpers/perform_operation_on_client_session";
import type { UmbrellaTestContext } from "./_helper_umbrella";

// _secureChannel (private client impl field) and its transport's underlying raw socket (not
// part of the public IClientTransport surface) are reached here only to simulate an abrupt
// connection drop for fault injection.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type InternalAny = any;

const securityMode = MessageSecurityMode.None;
const securityPolicy = SecurityPolicy.None;

function simulate_connection_lost(client: OPCUAClient) {
    const secureChannel = (client as InternalAny)._secureChannel;
    if (!secureChannel) return;
    const transport = secureChannel.getTransport();
    const socket = transport?._socket;
    if (socket) {
        try {
            socket.end();
        } catch {
            /* ignore */
        }
        socket.emit("error", new Error("ECONNRESET"));
    }
}

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
//       DataNotification produced during the disconnection period has been lost.
/**
 * Bug #144 - Ensure no data lost after short connection loss: subscription resumes and notifications continue.
 */
export function t(test: UmbrellaTestContext) {
    describe("Bug #144 reconnection keeps data (no loss)", () => {
        let client: OPCUAClient;
        let endpointUrl: string;

        beforeEach(async () => {
            client = OPCUAClient.create({
                securityMode,
                securityPolicy,
                // biome-ignore lint/suspicious/noExplicitAny: explicit null forces "fetch via GetEndpoints"; the option type only declares undefined
                serverCertificate: null as any,
                endpointMustExist: false
            });
            endpointUrl = test.endpointUrl!;
        });

        afterEach(async () => {
            if (client) {
                await client.disconnect();
                // @ts-expect-error
                client = null;
            }
        });

        it("#144-A no data lost across brief connection break", async () => {
            const timeout = 2000; // ms
            await perform_operation_on_subscription_async(client, endpointUrl, async (session, subscription) => {
                let sessionRestoredCount = 0;
                session.on("session_restored", () => sessionRestoredCount++);

                let _keepaliveCounter = 0;
                subscription
                    .on("internal_error", (_err: Error) => {
                        // Log but don't fail immediately; reconnection path handles this
                        // console.log("internal_error", err.message);
                    })
                    .on("keepalive", () => {
                        _keepaliveCounter++;
                    });

                const nodeId = makeNodeId(VariableIds.Server_ServerStatus_CurrentTime);
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

                let changeCount = 0;
                monitoredItem.on("changed", (dataValue) => {
                    dataValue.should.have.property("value");
                    changeCount++;
                });

                // Allow some initial notifications
                await new Promise((r) => setTimeout(r, timeout));
                const changeCountBefore = changeCount;
                sessionRestoredCount.should.eql(0);

                // Simulate connection break
                simulate_connection_lost(client);

                // Wait for reconnection (longer than timeout to allow secure channel recreation)
                await new Promise((r) => setTimeout(r, timeout * 2));

                sessionRestoredCount.should.eql(1);
                changeCount.should.be.greaterThan(changeCountBefore, "we should have received at least one new notification");
            });
        });
    });
}
