import "should";

import { CloseSecureChannelResponse, MessageSecurityMode, ServiceFault, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";

import { clone_buffer } from "node-opcua-buffer-utils";
import { hexDump, makeBufferFromTrace } from "node-opcua-debug";

import { make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");

import { IDerivedKeyProvider, MessageBuilder, MessageChunker, SecurityPolicy } from "../dist/source";
import * as fixture from "../dist/test_fixtures/fixture_GetEndPointResponse";


const derivedKeyProvider: IDerivedKeyProvider = {
    getDerivedKey(tokenId: number) {
        return null;
    }
};
describe("SecureMessageChunkManager", function () {
    it("should reconstruct a valid message when message is received in multiple chunks", async () => {
        // a very large endPointResponse spanning on multiple chunks ...
        const endPointResponse = fixture.fixture2;

        const requestId = 0x1000;

        const chunk_stack: Buffer[] = [];


        const options = {
            channelId: 1,
            securityHeader: new SymmetricAlgorithmSecurityHeader(),
            securityOptions: {
                requestId: requestId,
                tokenId: 1,
                cipherBlockSize: 0,
                plainBlockSize: 0,
                sequenceHeaderSize: 0,
                signatureLength: 0,
                channelId: 1,
                chunkSize: 0,
            }

        };
        endPointResponse.responseHeader.requestHandle = requestId;

        const chunker = new MessageChunker({
            securityMode: MessageSecurityMode.None,
        });

        await new Promise<void>((resolve, reject) => {
            chunker.chunkSecureMessage(
                "MSG",
                options,
                endPointResponse,
                (messageChunk?: Buffer | null) => {
                    if (messageChunk) {
                        chunk_stack.push(clone_buffer(messageChunk));
                    } else {
                        resolve();
                    }
                }
            );
        });

        chunk_stack.length.should.be.greaterThan(0);

        // let verify that each intermediate chunk is marked with "C" and final chunk is marked with "F"
        for (let i = 0; i < chunk_stack.length - 1; i++) {
            String.fromCharCode(chunk_stack[i].readUInt8(3)).should.equal("C");
        }
        String.fromCharCode(chunk_stack[chunk_stack.length - 1].readUInt8(3)).should.equal("F");



        chunk_stack.length.should.be.greaterThan(0);

        // now apply the opposite operation by reconstructing the message from chunk and
        // decoding the inner object

        // console.log(" message Builder");
        const messageBuilder = new MessageBuilder(derivedKeyProvider, {
            name: "client"
        });
        messageBuilder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);

        new Promise<void>((resolve, reject) => {
            messageBuilder
                .on("full_message_body", function (full_message_body) {
                    /** */
                })
                .on("message", (reconstructed_message) => {
                    // message has been fully reconstructed here :
                    // check that the reconstructed message equal the original_message

                    //xx console.log("message = ", util.inspect(reconstructed_message, {colors: true,depth: 10}));
                    //xx console.log("origianm= ",  util.inspect(endPointResponse, {colors: true,depth: 10}));

                    reconstructed_message.toString().should.eql(endPointResponse.toString());
                    // check also that requestId has been properly installed by chunkSecureMessage

                    resolve();
                })
                .on("error", function (errCode) {
                    reject(new Error("Error : code 0x" + errCode.toString()));
                });

            // feed messageBuilder with
            chunk_stack.forEach((chunk: Buffer) => {
                // let simulate a real TCP communication
                // where our messageChunk would be split into several packages ...

                const l1 = Math.round(chunk.length / 3); // arbitrarily split into 2 packets : 1/3 and 2/3

                // just for testing the ability to reassemble data block
                const data1 = chunk.subarray(0, l1);
                const data2 = chunk.subarray(l1);

                messageBuilder.feed(data1);
                messageBuilder.feed(data2);
            });
        });

    });

    it("should receive and handle an ERR message", function (done) {
        const messageBuilder = new MessageBuilder(derivedKeyProvider, {
            name: "MessageBuilder"
        });
        messageBuilder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
        messageBuilder
            .on("full_message_body", function (full_message_body) {
                debugLog(" On raw Buffer \n");
                debugLog(hexDump(full_message_body));
            })
            .on("message", (message) => {
                debugLog(" message ", message.toString());
                const msg = message as ServiceFault;
                msg.responseHeader.serviceResult.value.should.eql(0x80820000);

                done();
            })
            .on("error", function (errCode) {
                debugLog(" errCode ", errCode);
                done(new Error("Unexpected error event received"));
            });

        const packet = makeBufferFromTrace(
            `00000000: 4d 53 47 46 64 00 00 00 0c 00 00 00 01 00 00 00 04 00 00 00 03 00 00 00 01 00 8d 01 00 00 00 00    MSGFd...........................
             00000020: 00 00 00 00 00 00 00 00 00 00 82 80 24 00 00 00 00 00 00 00 80 01 00 00 00 24 00 00 00 55 6e 65    ............$............$...Une
             00000040: 78 70 65 63 74 65 64 20 65 72 72 6f 72 20 70 72 6f 63 65 73 73 69 6e 67 20 72 65 71 75 65 73 74    xpected.error.processing.request
             00000060: 2e 00 00 00                                                                                        ....
             `
        );
        messageBuilder.feed(packet);
    });
    it("should test CloseSecureChannelResponse", function () {
        // note: CloseSecureChannelResponse is a special case because it is never send by the server
        const response = new CloseSecureChannelResponse({});
        encode_decode_round_trip_test(response);
    });
});
