import "should";
import {
    OPCUAClient,
    UserTokenType,
    StatusCodes
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

// Reproduces bug #146: reopen (i.e. continue using) an anonymous session then change identity to Username/Password
// Original JS steps:
//  1. connect anonymously
//  2. create anonymous session
//  3. changeUser to username/password (user2/password2)
//  4. close session without error

export function t(test: TestHarness) {
    describe("Testing bug #146 - reopening Anonymous Session with Username password", () => {
        let client: OPCUAClient; let endpointUrl: string;

        beforeEach(() => {
            client = OPCUAClient.create({ endpointMustExist: false });
            endpointUrl = test.endpointUrl;
        });

        afterEach(async () => {
            if (client) {
                await client.disconnect();
            }
        });

        it("should reopen an Anonymous Session with UserName password", async () => {
            await client.connect(endpointUrl);
            const session = await client.createSession(); // anonymous by default
            try {
                const statusCode = await session.changeUser({
                    type: UserTokenType.UserName,
                    userName: "user2",
                    password: (() => "password2")()
                });
                statusCode.should.eql(StatusCodes.Good);
            } finally {
                await session.close();
            }
        });
    });
}
