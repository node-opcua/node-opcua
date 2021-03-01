
"use strict";
import * as should from "should";

import { makeNodeId, DataType, AttributeIds, OPCUAClient, ClientSession, ClientSubscription } from "node-opcua";

// tslint:disable-next-line: no-var-requires
const { perform_operation_on_subscription_async } = require("../../test_helpers/perform_operation_on_client_session");

export function t(test: any) {
    describe("write multi-dimensional-array", () => {
        let client: OPCUAClient | undefined;
        beforeEach(() => {
            client = OPCUAClient.create({});
        });
        afterEach(() => {
            client = undefined;
        });
        it("MDA-1 DA", async () => {
            await perform_operation_on_subscription_async(
                client,
                test.endpointUrl,
                async (session: ClientSession, subscription: ClientSubscription) => {
                    const namespaceArray = await session.readNamespaceArray();
                    const simulationNamespaceIndex = namespaceArray.indexOf("urn://node-opcua-simulator");

                    const nodeId = `ns=${simulationNamespaceIndex};s=Static_MultiDimensional_Array_Float`;

                    const dataValue = await session.read({
                        nodeId,
                        attributeId: AttributeIds.Value
                    });
                    //  console.log("Here", dataValue.toString());
                    const status = await session.write({
                        nodeId,
                        attributeId: AttributeIds.Value
                    });
                }
            );
        });
    });
}
