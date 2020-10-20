import { OPCUAServer, OPCUAClient } from "node-opcua";
import * as should from "should";
const _should = should;
const port = 25400;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Verifying Server Endpoint", () => {
    let server: OPCUAServer;
    let endpointUri: string = `opc.tcp://localhost:${port}`;
    before(async () => {
        server = new OPCUAServer({ port });
        await server.initialize();
        await server.start();
        endpointUri = server.endpoints[0].endpointDescriptions()[0].endpointUrl!;
    });

    after(async () => {
        await server.shutdown();
    });

    it("should not have duplicated policies inside a single endpoint", async () => {
        // given a server
        const client = OPCUAClient.create({ endpoint_must_exist: false });

        await client.connect(endpointUri);

        const endpointDescriptions = await client.getEndpoints();

        try {
            for (const e of endpointDescriptions) {
                // console.log(e.toString());
                const policyIds = e.userIdentityTokens!.map((a) => a.policyId!);

                const counters: { [key: string]: number } = {};
                policyIds?.forEach((a: string) => {
                    counters[a] = (counters[a] || 0) + 1;
                });
                const duplicatedPolicies = Object.entries(counters)
                    .filter(([k, v]) => v !== 1)
                    .map(([k, v]) => k);

                if (duplicatedPolicies.length) {
                    console.log("duplicated policies", duplicatedPolicies);
                }

                duplicatedPolicies.should.eql([], "endpoint " + e.securityPolicyUri + " must not exhibit duplicated policies");
            }
        } catch (err) {
            throw err;
        } finally {
            await client.disconnect();
        }
    });
    it("should not have duplicated policies within the server", async () => {
        // given a server
        const client = OPCUAClient.create({ endpoint_must_exist: false });

        await client.connect(endpointUri);

        const endpointDescriptions = await client.getEndpoints();

        try {
            const counters: { [key: string]: number } = {};

            for (const e of endpointDescriptions) {
                // console.log(e.toString());
                const policyIds = e.userIdentityTokens!.map((a) => a.policyId!);

                policyIds?.forEach((a: string) => {
                    counters[a] = (counters[a] || 0) + 1;
                });
            }
            const duplicatedPolicies = Object.entries(counters)
                .filter(([k, v]) => v !== 1)
                .map(([k, v]) => k);

            if (duplicatedPolicies.length) {
                console.log("duplicated policies", duplicatedPolicies);
            }

            duplicatedPolicies.should.eql([], "duplicated policies found");
        } catch (err) {
            throw err;
        } finally {
            await client.disconnect();
        }
    });
});
