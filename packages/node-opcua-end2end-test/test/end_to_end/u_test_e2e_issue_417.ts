import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session.js";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

export function t(test: UmbrellaTestContext) {
    describe("OPCUAClient#getEndpoints returns valid endpointUrl (#417)", () => {
        it("#417 endpoints contain opc.tcp scheme", async () => {
            if (!test.server) return; // skip if no embedded server
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl!, async (_session) => {
                const endpoints = await client.getEndpoints({});
                endpoints.should.be.Array().and.not.empty();
                should(endpoints[0].endpointUrl).match(/opc\.tcp:/);
            });
        });
    });
}
