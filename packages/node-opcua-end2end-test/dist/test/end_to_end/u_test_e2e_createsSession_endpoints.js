import os from "node:os";
import { OPCUAClient } from "node-opcua";
import should from "should";
async function testCreateSessionResponse(endpointUrl) {
    const client1 = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: {
            maxRetry: 1
        }
    });
    let createSessionResponse = null;
    let _createSessionRequest = null;
    client1.on("send_request", (c) => {
        if (c.constructor.name === "CreateSessionRequest") {
            _createSessionRequest = c;
        }
    });
    client1.on("receive_response", (c) => {
        if (c.constructor.name === "CreateSessionResponse") {
            createSessionResponse = c;
        }
    });
    try {
        await client1.connect(endpointUrl);
        const session = await new Promise((resolve, reject) => {
            client1._createSession((err, session) => {
                if (err) {
                    return reject(err);
                }
                else {
                    resolve(session);
                }
            });
        });
        await session.close();
    }
    catch (err) {
        console.log("Error = ", err.message);
        console.log(err);
        return { createSessionResponse, err: err };
    }
    finally {
        await client1.disconnect();
    }
    // console.log("c", createSessionResponse.toString());
    return { createSessionResponse };
}
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
export function t(test) {
    describe("PP1 CreateSessionResponse endpoints", () => {
        it("should receive server endpoint in CreateSessionResponse when endpointUrl user by the client matches a valid endpoint", async () => {
            const endpointUrl = test.endpointUrl;
            //xx console.log("e=", endpointUrl);
            const { createSessionResponse, err } = await testCreateSessionResponse(endpointUrl);
            should.not.exist(err);
            should(createSessionResponse?.serverEndpoints?.length).eql(7);
            should(createSessionResponse?.serverEndpoints?.[0].endpointUrl).eql(test.endpointUrl);
        });
        it("should receive server endpoint in CreateSessionResponse when endpointUrl used by the client doesn't match a valid endpoint", async () => {
            const match = test.endpointUrl.match(/:([0-9]*)$/);
            const port = parseInt(match[1], 10);
            const endpointUrl = `opc.tcp://${os.hostname()}:${port}`;
            // console.log(endpointUrl);
            const { createSessionResponse, err } = await testCreateSessionResponse(endpointUrl);
            should.not.exist(err);
            should(createSessionResponse?.serverEndpoints?.length).eql(7);
            should(createSessionResponse?.serverEndpoints?.[0].endpointUrl).eql(test.endpointUrl);
        });
    });
}
//# sourceMappingURL=u_test_e2e_createsSession_endpoints.js.map