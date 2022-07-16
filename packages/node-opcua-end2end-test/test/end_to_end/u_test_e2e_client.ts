import * as should from "should";
import * as sinon from "sinon";
import { AttributeIds, DataType, DataValue, OPCUAClient, ReadValueIdOptions, WriteValueOptions } from "node-opcua";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
export function t(test: any) {
    describe("Testing Client Connection ", function (this: any) {
        it("TCC1 - it should raise an error if connect is called with an empty endpoint", async () => {
            const client = OPCUAClient.create({});

            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            const empty_endpoint = "";
            let _err: Error | null = null;
            try {
                await client.connect(empty_endpoint);
            } catch (err) {
                _err = err as Error;
            }
            should.exist(_err, "expecting an error here");
            _err!.message.should.match("Invalid endpoint");
            closeSpy.callCount.should.eql(0);
        });

        it("TCC2 - it should raise an error if connect is called with an invalid endpoint", async () => {
            const client = OPCUAClient.create({ connectionStrategy: { maxRetry: 0 } });
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            async function test() {
                try {
                    await client.connect("invalid-proto://test-host");
                } catch (err) {
                    console.log((err as Error).message);
                    throw err;
                }
            }
            test().should.be.rejectedWith(/The connection has been rejected/);
            closeSpy.callCount.should.eql(0);
        });

        it("TCC3 - it should raise an error when connect is called while client is already connected", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            await client.connect(test.endpointUrl);
            closeSpy.callCount.should.eql(0);

            let _err: Error | undefined = undefined;
            try {
                await client.connect(test.endpointUrl);
            } catch (err) {
                _err = err as Error;
            } finally {
                closeSpy.callCount.should.eql(0);
                await client.disconnect();
            }
            should.exist(_err, " ");
            _err!.message.should.match(/invalid internal state = connected/);
            closeSpy.callCount.should.eql(1);
        });

        it("TCC4 - it should raise an error when connect is called while client is currently connecting", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            const p1 = client.connect(test.endpointUrl);

            let _err: Error | undefined = undefined;
            try {
                await client.connect(test.endpointUrl);
            } catch (err) {
                _err = err as Error;
            } finally {
                await p1;
                closeSpy.callCount.should.eql(0);
                await client.disconnect();
                closeSpy.callCount.should.eql(1);
            }
            should.exist(_err, " ");
            _err!.message.should.match(/invalid internal state = connecting/);
            closeSpy.callCount.should.eql(1);
        });

        it("TCC5 - it should not raise an error if disconnect is called when client is not connected", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);
            await client.disconnect();
            await client.disconnect();
            closeSpy.callCount.should.eql(0);
        });

        it("TCC6 - it should not raise an error if disconnect is called twice ", async () => {
            const client = OPCUAClient.create({});
            const closeSpy = sinon.spy();
            client.on("close", closeSpy);

            await client.connect(test.endpointUrl);

            closeSpy.callCount.should.eql(0);

            const p1 = client.disconnect();
            const p2 = client.disconnect();

            await p2;
            await p1;
            closeSpy.callCount.should.eql(1);
        });

        it("TCC7 - it should  raise an warning if sessionTimeout are not compatible with subscription parameters", async () => {
            const client = OPCUAClient.create({
                requestedSessionTimeout: 1000
            });
            await client.connect(test.endpointUrl);
            const session = await client.createSession();

            try {
                const subscription = await session.createSubscription2({
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    requestedLifetimeCount: 100,

                    requestedMaxKeepAliveCount: 100,
                    requestedPublishingInterval: 1000
                });
            } catch (err) {
                if (err instanceof Error) {
                    // [NODE-OPCUA-W09] The subscription parameters are not compatible with the session timeout
                    err.message.should.match(/\[NODE-OPCUA-W09\]/);
                    console.log(err.message);
                }
            }

            await session.close();
            await client.disconnect();
        });

        it("TCC8 - should abort automatic reconnection if client use special transport settings that are too restrictive", async () => {
            // given a client with a ridiculously small message buffer size
            const client = OPCUAClient.create({
                requestedSessionTimeout: 1000,
                transportSettings: {
                    maxChunkCount: 1, // ridiculously small max chunk count
                    maxMessageSize: 1 * 8192, // should be at least 8192
                    receiveBufferSize: 8192,
                    sendBufferSize: 8192
                },
                connectionStrategy: {
                    initialDelay: 10,
                    maxDelay: 100,
                    maxRetry: -1
                }
            });

            // When I try to connect to the server
            let _err: Error | undefined = undefined;
            try {
                await client.connect(test.endpointUrl);
            } catch (err) {
                _err = err as Error;
            }

            // Then the client should fail gracefully to connect
            // it should not try to match the reconnection strategy because
            // it is worthless keeping trying to reconnect with such TcpMessage error message
            should.exist(_err);
            // and should return BadTcpMessageTooLarge message
            _err!.message.should.match(
                /The connection may have been rejected by server|BadTcpMessageTooLarge|max chunk count exceeded|received an Abort Message/
            );

            await client.disconnect();

            console.log("Disconnected !");
        });

        it("TCC9 - write a very large message ", async () => {
            // given a client with correct transport settings
            const client = OPCUAClient.create({
                requestedSessionTimeout: 1000,
                transportSettings: {
                    maxChunkCount: 20,
                    maxMessageSize: 1000 * 8192, // should be at least 8192
                    receiveBufferSize: 10 * 8192,
                    sendBufferSize: 10 * 8192
                },
                connectionStrategy: {
                    initialDelay: 10,
                    maxDelay: 100,
                    maxRetry: -1
                }
            });
            function makeLargeDataWrite() {
                const value = new DataValue({
                    value: {
                        dataType: DataType.ByteString,
                        value: Buffer.alloc(100 * 8192)
                    }
                });

                const nodeId = "ns=2;s=Static_Scalar_ByteString";

                const nodesToWrite: WriteValueOptions[] = [
                    { nodeId, attributeId: AttributeIds.Value, value },
                    { nodeId, attributeId: AttributeIds.Value, value },
                    { nodeId, attributeId: AttributeIds.Value, value },
                    { nodeId, attributeId: AttributeIds.Value, value }
                ];
                return nodesToWrite;
            }
            const nodesToWrite = makeLargeDataWrite();

            let _err: Error | undefined = undefined;
            await client.withSessionAsync(test.endpointUrl, async (session) => {
                try {
                    const statusCode = await session.write(nodesToWrite);
                } catch (err) {
                    console.log(err);
                    _err = err as Error;
                    console.log(_err.message);
                }
            });
            should.exist(_err);
            console.log("err.response", (_err! as any).response.toString());
            (_err! as any).response.responseHeader.stringTable[0].should.match(
                /chunkCount exceeds the negotiated maximum message count/
            );
        });
        it("TCCA - read a very large message - server send ServerFault instead of ReadResponse", async () => {
            // given a client with correct transport settings
            const client = OPCUAClient.create({
                requestedSessionTimeout: 1000,
                transportSettings: {
                    maxChunkCount: 20, // relatively small max chunk count to allow connection but fail large read, on the return of the read request
                    maxMessageSize: 1000 * 8192, //  very confortable size
                    receiveBufferSize: 10 * 8192,
                    sendBufferSize: 10 * 8192
                },
                connectionStrategy: {
                    initialDelay: 10,
                    maxDelay: 100,
                    maxRetry: -1
                }
            });
            const nodeId = "ns=2;s=Static_Scalar_ByteString";

            function makeLargeDataRead(): ReadValueIdOptions[] {
                const nodesToRead: ReadValueIdOptions[] = [
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.Value }
                ];
                return nodesToRead;
            }
            function makeSingleLargeDataWrite() {
                const value = new DataValue({
                    value: {
                        dataType: DataType.ByteString,
                        value: Buffer.alloc(100 * 8192)
                    }
                });

                const nodesToWrite: WriteValueOptions[] = [{ nodeId, attributeId: AttributeIds.Value, value }];
                return nodesToWrite;
            }
            const nodesToWrite = makeSingleLargeDataWrite();
            const nodesToRead = makeLargeDataRead();

            let _err: Error | undefined = undefined;
            await client.withSessionAsync(test.endpointUrl, async (session) => {
                const statusCode = await session.write(nodesToWrite);
                console.log("statusCode", statusCode.toString());
                try {
                    const dataValues = await session.read(nodesToRead);
                } catch (err) {
                    console.log(err);
                    _err = err as Error;
                    console.log(_err.message);
                }
            });
            should.exist(_err);
            _err!.message.should.match(/BadOperationAbandoned|BadTcpMessageTooLarge/);
        });
    });
}
