import {
    OPCUAClient,
    ReadRequest,
    TimestampsToReturn,
    StatusCodes,
    UserTokenType,
    Request,
    Response,
    ClientSession
} from "node-opcua";
import should from "should";
import { promisify } from "util";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../../test_helpers/assert_throw";


type OPCUAClientEx = OPCUAClient & {
    _createSession: any,
    _activateSession: any,
    performMessageTransaction(request: Request, callback: (err: Error | null, result: Response) => void): void;
}

async function performMessageTransaction(client: OPCUAClient, request: Request): Promise<Response> {
    return new Promise((resolve, reject) => {
        (client as OPCUAClientEx).performMessageTransaction(request, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result!);
        });
    });
}
async function _activateSession(client: OPCUAClient, session: any, userIdentityInfo: any): Promise<void> {
    return new Promise((resolve, reject) => {
        (client as OPCUAClientEx)._activateSession(session, userIdentityInfo, (err: Error | null) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}
async function _createSession(client: OPCUAClient): Promise<ClientSession> {
    return new Promise((resolve, reject) => {
        (client as OPCUAClientEx)._createSession((err: Error | null, session?: ClientSession) => {
            if (err) {
                return reject(err);
            }
            resolve(session!);
        });
    });
}

export function t(test: { endpointUrl: string }) {

    let client: OPCUAClient;
    describe("SNAC Testing client accessing service before session is activated ", function () {

        beforeEach(() => {
            client = OPCUAClient.create({});
        });
        afterEach(() => {
        });

        it("SNAC1- should return BadSessionNotActivated when service is called before session is activated", async () => {

            await client.connect(test.endpointUrl);

            try {

                // create the session (without activating it)
                const session1 = await _createSession(client);

                try {


                    // let verify that it is now possible to send a request on client1's session
                    {
                        const readRequest = new ReadRequest({
                            nodesToRead: [{ nodeId: "i=2255", attributeId: 13 }],
                            maxAge: 0,
                            timestampsToReturn: TimestampsToReturn.Both
                        });
                        readRequest.requestHeader.authenticationToken = session1.authenticationToken!;

                        await assertThrow(async () => {
                            await performMessageTransaction(client, readRequest);
                        }, /BadSessionNotActivated/);
                    }

                    // verify the session can no longer be used, because a command has already been sent
                    const userIdentityInfo = { type: UserTokenType.Anonymous };

                    const activateSessionError = await assertThrow(async () => {
                        await _activateSession(client, session1, userIdentityInfo);
                    }, /BadSessionIdInvalid|BadSessionClosed/)

                    should.exist(activateSessionError,
                        "Activate Session should return an error if there has been an attempt to use it before being activated");
                } finally {
                    await client.closeSession(session1, true);
                    console.log("disconnecting");
                }
            } finally {
                await client.disconnect();
            }
        });
    });

}

