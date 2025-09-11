import "should";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server?: any; [k: string]: any }

export function t(test: TestHarness) {
    describe("OPCUAClient#getEndpoints returns valid endpointUrl (#417)", () => {
        it("#417 endpoints contain opc.tcp scheme", async () => {
            if (!test.server) return; // skip if no embedded server
            const client = OPCUAClient.create({});
            await perform_operation_on_client_session(client, test.endpointUrl, async (session) => {
                const endpoints: any = await new Promise((resolve, reject) => {
                    (client as any).getEndpoints({}, (err: Error, ep: any) => err ? reject(err) : resolve(ep));
                });
                endpoints.should.be.Array().and.not.empty();
                endpoints[0].endpointUrl.should.match(/opc\.tcp:/);
            });
        });
    });
}