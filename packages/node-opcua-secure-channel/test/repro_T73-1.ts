
import "should";
import {
    ServerSecureChannelLayer,
    MessageSecurityMode,
    SecurityPolicy,
    MessageChunker
} from "../dist/source";
import { AsymmetricAlgorithmSecurityHeader, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { BinaryStream } from "node-opcua-binary-stream";
import { TransportPairDirect } from "node-opcua-transport/dist/test_helpers";
import {
    OpenSecureChannelRequest,
    SecurityTokenRequestType
} from "node-opcua-types";
import { helloMessage1 } from "node-opcua-transport/dist/test-fixtures";

describe("T73-1 Reproduction: Sequence Number Reset on Renewal", function () {

    it("should strictly increase sequence numbers across secure channel renewal", async () => {
     
        const transportPair = new TransportPairDirect();
        const serverSecureChannel = new ServerSecureChannelLayer({
            parent: {
                getCertificate: () => Buffer.alloc(0),
                getCertificateChain: () => Buffer.alloc(0),
                getPrivateKey: () => null as any,
                getEndpointDescription: () => ({}) as any,
                certificateManager: {
                    checkCertificate: async () => ({ isGood: () => true })
                } as any
            } as any
        });

        serverSecureChannel.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

        // Initialize channel
        const initPromise = new Promise<void>((resolve, reject) => {
            serverSecureChannel.init(transportPair.server, (err) => err ? reject(err) : resolve());
        });

        transportPair.client.write(helloMessage1);
        await initPromise;

        // Capture sequence numbers sent by server
        const sequenceNumbers: number[] = [];
        transportPair.client.on("data", (chunk: Buffer) => {
            // Parse SequenceHeader
            const stream = new BinaryStream(chunk);
            stream.length = 12; // Skip MessageHeader

            // Decode Asymmetric Security Header
            try {
                // SecurityPolicyUri (String)
                const policyUriLen = stream.readUInt32();
                if (policyUriLen > 0 && policyUriLen < 1000) stream.length += policyUriLen;

                // SenderCertificate (ByteString)
                const senderCertLen = stream.readUInt32();
                if (senderCertLen > 0 && senderCertLen < 10000) stream.length += senderCertLen;

                // ReceiverCertificateThumbprint (ByteString)
                const thumbprintLen = stream.readUInt32();
                if (thumbprintLen > 0 && thumbprintLen < 1000) stream.length += thumbprintLen;

            } catch (err) {
                console.log("Error parsing headers:", err);
                return;
            }

            // Now at SequenceHeader
            const offset = stream.length;

            if (chunk.length >= offset + 8) {
                const seqNum = chunk.readUInt32LE(offset);
                sequenceNumbers.push(seqNum);
                // console.log("Received chunk with seqNum:", seqNum);
            }
        });

        const clientMessageChunker = new MessageChunker({
            securityMode: MessageSecurityMode.None,
        });

        async function sendChunk(msg: "OPN" | "MSG", request: any) {
            const securityHeader = msg === "OPN"
                ? new AsymmetricAlgorithmSecurityHeader({
                    securityPolicyUri: SecurityPolicy.None,
                    receiverCertificateThumbprint: null,
                    senderCertificate: null
                })
                : new SymmetricAlgorithmSecurityHeader({ tokenId: 1 }); // Assuming tokenId 1 for now

            return new Promise<void>((resolve, reject) => {
                clientMessageChunker.chunkSecureMessage(
                    msg,
                    {
                        channelId: serverSecureChannel.channelId,
                        securityHeader,
                        securityOptions: {
                            requestId: 100, // Client Request ID
                            chunkSize: 8192,
                            signatureLength: 0,
                            cipherBlockSize: 0,
                            plainBlockSize: 0,
                            sequenceHeaderSize: 0
                        }
                    },
                    request,
                    (chunk) => {
                        if (chunk) {
                            transportPair.client.write(chunk);
                        } else {
                            resolve();
                        }
                    }
                );
            });
        }

        // 1. Send OPN (Issue)
        const issueRequest = new OpenSecureChannelRequest({
            clientNonce: Buffer.alloc(1),
            clientProtocolVersion: 0,
            requestHeader: {},
            requestType: SecurityTokenRequestType.Issue,
            requestedLifetime: 100000,
            securityMode: MessageSecurityMode.None
        });
        await sendChunk("OPN", issueRequest);

        // Wait for response to Issue
        await new Promise(r => setTimeout(r, 200));

        // 2. Send OPN (Renew)
        const renewRequest = new OpenSecureChannelRequest({
            clientNonce: Buffer.alloc(1),
            clientProtocolVersion: 0,
            requestHeader: {},
            requestType: SecurityTokenRequestType.Renew,
            requestedLifetime: 100000,
            securityMode: MessageSecurityMode.None
        });
        await sendChunk("OPN", renewRequest);

        // Wait for response to Renew
        await new Promise(r => setTimeout(r, 200));

        // Verify sequence numbers
        // console.log("Recorded sequence numbers:", sequenceNumbers);
        if (sequenceNumbers.length < 2) {
            throw new Error("Did not receive enough responses");
        }

        // Check strict increase
        for (let i = 1; i < sequenceNumbers.length; i++) {
            if (sequenceNumbers[i] <= sequenceNumbers[i - 1]) {
                throw new Error(`Sequence number reset or not increasing! ${sequenceNumbers[i - 1]} -> ${sequenceNumbers[i]}`);
            }
        }

        await new Promise<void>((resolve) => {
            serverSecureChannel.close(() => {
                serverSecureChannel.dispose();
                resolve();
            });
        });
    });
});
