import "should";
import { type ClientSession, OPCUAClient, UserTokenType } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../../test_helpers/assert_throw";
import type { UmbrellaTestContext } from "./_helper_umbrella";

export function t(test: UmbrellaTestContext) {
    describe("testing basic Client-Server communication", () => {
        let endpointUrl: string;
        beforeEach(() => {
            endpointUrl = test.endpointUrl!;
        });

        it("C1 - testing with username === empty string", async () => {
            const client1 = OPCUAClient.create({});
            await client1.connect(endpointUrl);
            let session: ClientSession | undefined;

            try {
                // Accept either client-side validation or server-side status
                await assertThrow(async () => {
                    session = await client1.createSession({
                        type: UserTokenType.UserName,
                        userName: "",
                        password: (() => "blah")()
                    });
                }, /BadIdentityTokenInvalid|Invalid userIdentityInfo/);

                if (session) {
                    const activeSession = session;
                    await assertThrow(async () => {
                        await activeSession.close();
                    }, /BadSessionNotActivated/);
                }
            } finally {
                await client1.disconnect();
            }
        });
    });
}
