import "should";
import { OPCUAClient, UserTokenType } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../../test_helpers/assert_throw";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

export function t(test: TestHarness) {
    describe("testing basic Client-Server communication", () => {
        let endpointUrl: string;
        beforeEach(() => {
            endpointUrl = test.endpointUrl;
        });

        it("C1 - testing with username === empty string", async () => {
            const client1 = OPCUAClient.create({});
            await client1.connect(endpointUrl);
            let session: any;

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
                    await assertThrow(async () => {
                        await session.close();
                    }, /BadSessionNotActivated/);
                }
            } finally {
                await client1.disconnect();
            }
        });
    });
}
