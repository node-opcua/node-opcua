import "should";
import { OPCUAClient, MessageSecurityMode, SecurityPolicy, ServerSecureChannelLayer } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

const doDebug = false;

export function t(test: TestHarness) {
    describe("Testing bug #73 - Server resets sequence number after secure channel renewal", function () {
        before(function () { this.timeout(Math.max(200000, this.timeout())); });

        let endpointUrl: string;
        let oldMin: number;
        beforeEach(() => {
            oldMin = (ServerSecureChannelLayer as any).g_MinimumSecureTokenLifetime;
            (ServerSecureChannelLayer as any).g_MinimumSecureTokenLifetime = 250;
            endpointUrl = test.endpointUrl;
        });
        afterEach(() => {
            (ServerSecureChannelLayer as any).g_MinimumSecureTokenLifetime = oldMin;
        });

        [
            { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None },
            { securityMode: MessageSecurityMode.SignAndEncrypt, securityPolicy: SecurityPolicy.Basic256Sha256 }
        ].forEach(({ securityMode, securityPolicy }, index) =>
            it(`T73-${index} should not reset sequence number after secure channel renewal ${MessageSecurityMode[securityMode]} - ${securityPolicy}`, async () => {
                const client = OPCUAClient.create({
                    securityMode,
                    securityPolicy,
                    serverCertificate: null as any,
                    defaultSecureTokenLifetime: 200
                });
                const sequenceNumbers: number[] = [];
                const messages: string[] = [];

                client.on("secure_channel_created", (channel: any) => {
                    channel.on("message", (msg: any) => {
                        try {
                            messages.push(msg.constructor.name);
                            sequenceNumbers.push(channel._getMessageBuilder().sequenceHeader.sequenceNumber);
                        } catch (err) {
                            // ignore
                        }
                    });
                });

                await client.withSessionAsync(endpointUrl, async (session) => {

                    let counter_on_session = 0;
                    session.on("security_token_renewed", () => {
                        counter_on_session++;
                    });

                    let counter = 0;
                    await new Promise<void>((resolve) => {
                        client.on("security_token_renewed", () => {
                            counter++;
                            if (counter >= 3) resolve();
                        });
                    });
                });

                
                // Expect multiple secure channel renewals (OpenSecureChannelResponse messages)
                messages.filter((a) => a === "OpenSecureChannelResponse").length.should.be.greaterThan(2);

                // Sequence numbers strictly increasing
                if (doDebug) console.log(sequenceNumbers);
                for (let i = 1; i < sequenceNumbers.length; i++) {
                    sequenceNumbers[i].should.be.greaterThan(sequenceNumbers[i - 1]);
                }
            })
        );
    });
}
