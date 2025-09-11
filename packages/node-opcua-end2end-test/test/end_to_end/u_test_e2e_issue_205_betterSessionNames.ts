import "should";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }


export function t(test: TestHarness) {
    describe("Testing enhancement request #205 - set client name to get meaningful session name", () => {
        it("Default client sessionName", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                session.name.should.eql("ClientSession1");
            });
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                session.name.should.eql("ClientSession2");
            });
        });

        it("Client with custom clientName has incrementing expressive sessionName", async () => {
            const client = OPCUAClient.create({ clientName: "ABCDEF-" });
            const endpointUrl = test.endpointUrl;
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                session.name.should.eql("ABCDEF-1");
            });
            await perform_operation_on_client_session(client, endpointUrl, async (session) => {
                session.name.should.eql("ABCDEF-2");
            });
        });
    });
}
