import "should";
import { OPCUAClient, StatusCodes, AttributeIds } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { assertThrow } from "../../test_helpers/assert_throw";

/**
 * Bug #455 - OPCUASession#readVariableValue
 *
 * Intent (restored from original test comments):
 * 1. When the client API `readVariableValue` is invoked with a string that CANNOT be coerced to a valid NodeId,
 *    the client shall throw synchronously (i.e. before any request is sent over the wire). This validates the
 *    client-side nodeId parsing logic and prevents useless round-trips.
 * 2. When a WELL-FORMED NodeId (string form) is provided but it does NOT exist on the server, the service call
 *    proceeds and the server returns a DataValue whose StatusCode is BadNodeIdUnknown (no Value). The same
 *    behavior must be observed both via `readVariableValue` convenience method and the generic `read` service.
 *
 */

interface TestHarness { endpointUrl: string;[k: string]: any }

export function t(test: TestHarness) {
    describe("Bug #455 - readVariableValue invalid nodeId handling", () => {
        it("detects badly formed nodeId and throws before server call", async () => {
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                // (1) Pass an INVALID nodeId string (cannot be coerced) -> expect a synchronous client-side exception
                await assertThrow(async () => {
                    await session.readVariableValue(
                        "ns=2;i=INVALID_NODE_ID_THAT_SHOULD_CAUSE_EXCEPTION_IN_CLIENT"
                    );
                }, /INVALID/i);

                await assertThrow(async () => {
                    await session.read({
                        nodeId: "ns=2;i=INVALID_NODE_ID_THAT_SHOULD_CAUSE_EXCEPTION_IN_CLIENT"
                    });
                }, /INVALID/i);

                // (2) Provide a VALID but UNKNOWN nodeId -> call succeeds round-trip, server returns BadNodeIdUnknown
                const dv1 = await session.readVariableValue("ns=2;i=10000");
                dv1.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);

                // (3) Same behavior using the generic Read service
                const dv2 = await session.read({ nodeId: "ns=2;i=10000", attributeId: AttributeIds.Value });
                dv2.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
            });
        });
    });
}