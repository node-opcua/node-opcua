import os from "node:os";
import { type ClientSession, type CreateSessionRequest, type CreateSessionResponse, OPCUAClient } from "node-opcua";
import should from "should";

// _createSession is a private OPCUAClient implementation method, reached here to
// observe the raw CreateSessionResponse before the public createSession() wrapper runs.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type InternalAny = any;

async function testCreateSessionResponse(
    endpointUrl: string
): Promise<{ createSessionResponse: CreateSessionResponse | null; err?: Error }> {
    const client1 = OPCUAClient.create({
        endpointMustExist: false,
        connectionStrategy: {
            maxRetry: 1
        }
    });
    let createSessionResponse: CreateSessionResponse | null = null;
    let _createSessionRequest: CreateSessionRequest | null = null;
    client1.on("send_request", (c) => {
        if (c.constructor.name === "CreateSessionRequest") {
            _createSessionRequest = c as CreateSessionRequest;
        }
    });
    client1.on("receive_response", (c) => {
        if (c.constructor.name === "CreateSessionResponse") {
            createSessionResponse = c as CreateSessionResponse;
        }
    });
    try {
        await client1.connect(endpointUrl);

        const session = await new Promise<ClientSession>((resolve, reject) => {
            (client1 as InternalAny)._createSession((err: Error | null, session: ClientSession) => {
                if (err) {
                    return reject(err);
                } else {
                    resolve(session);
                }
            });
        });
        await session.close();
    } catch (err) {
        console.log("Error = ", (err as Error).message);
        console.log(err);
        return { createSessionResponse, err: err as Error };
    } finally {
        await client1.disconnect();
    }
    // console.log("c", createSessionResponse.toString());
    return { createSessionResponse };
}

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

export function t(test: { endpointUrl: string }) {
    describe("PP1 CreateSessionResponse endpoints", () => {
        it("should receive server endpoint in CreateSessionResponse when endpointUrl user by the client matches a valid endpoint", async () => {
            const endpointUrl = test.endpointUrl;
            //xx console.log("e=", endpointUrl);
            const { createSessionResponse, err } = await testCreateSessionResponse(endpointUrl);
            should.not.exist(err);
            createSessionResponse?.serverEndpoints?.length.should.eql(7);
            createSessionResponse?.serverEndpoints?.[0].endpointUrl?.should.eql(test.endpointUrl);
        });
        it("should receive server endpoint in CreateSessionResponse when endpointUrl used by the client doesn't match a valid endpoint", async () => {
            const match = test.endpointUrl.match(/:([0-9]*)$/)!;
            const port = parseInt(match[1], 10);
            const endpointUrl = `opc.tcp://${os.hostname()}:${port}`;
            // console.log(endpointUrl);
            const { createSessionResponse, err } = await testCreateSessionResponse(endpointUrl);
            should.not.exist(err);
            createSessionResponse?.serverEndpoints?.length.should.eql(7);
            createSessionResponse?.serverEndpoints?.[0].endpointUrl?.should.eql(test.endpointUrl);
        });
    });
}
