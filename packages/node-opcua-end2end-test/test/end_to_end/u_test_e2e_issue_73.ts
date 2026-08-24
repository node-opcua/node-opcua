import "should";
import { MessageSecurityMode, OPCUAClient, SecurityPolicy, ServerSecureChannelLayer } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { UmbrellaTestContext } from "./_helper_umbrella";

const doDebug = false;

export function t(test: UmbrellaTestContext) {
    describe("Testing bug #73 - Server resets sequence number after secure channel renewal", () => {
        before(function () {
            this.timeout(Math.max(200000, this.timeout()));
        });

        let endpointUrl: string;
        let oldMin: number;
        beforeEach(() => {
            oldMin = ServerSecureChannelLayer.g_MinimumSecureTokenLifetime;
            ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = 500;
            endpointUrl = test.endpointUrl!;
        });
        afterEach(() => {
            ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = oldMin;
        });

        [
            { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None },
            { securityMode: MessageSecurityMode.SignAndEncrypt, securityPolicy: SecurityPolicy.Basic256Sha256 }
        ].forEach(({ securityMode, securityPolicy }, index) => {
            it(`T73-${index} should not reset sequence number after secure channel renewal ${MessageSecurityMode[securityMode]} - ${securityPolicy}`, async () => {
                const client = OPCUAClient.create({
                    securityMode,
                    securityPolicy,
                    // biome-ignore lint/suspicious/noExplicitAny: explicit null forces "fetch via GetEndpoints"; the option type only declares undefined
                    serverCertificate: null as any,
                    defaultSecureTokenLifetime: 500
                });
                const sequenceNumbers: number[] = [];
                const messages: string[] = [];

                client.on("secure_channel_created", (channel) => {
                    channel.on("message", (msg) => {
                        try {
                            messages.push(msg.constructor.name);
                            sequenceNumbers.push(channel._getMessageBuilder()!.sequenceHeader!.sequenceNumber);
                        } catch (_err) {
                            // ignore
                        }
                    });
                });

                await client.withSessionAsync(endpointUrl, async (session) => {
                    let _counter_on_session = 0;
                    session.on("security_token_renewed", () => {
                        _counter_on_session++;
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
            });
        });
    });
}
