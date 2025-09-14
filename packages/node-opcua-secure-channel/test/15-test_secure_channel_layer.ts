import os from "os";
import net from "net";
import { promisify } from "util";
import sinon from "sinon";
import should from "should";
import { MessageSecurityMode, ReadRequest } from "node-opcua-types";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assert } from "node-opcua-assert";
import { ClientSecureChannelLayer, ClientSecureChannelLayerOptions, SecurityPolicy, ServerSecureChannelLayer } from "..";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port1 = 2043;
const port2 = 2044;
const port3 = 2045;
const port4 = 2046;
const port5 = 2047;

async function pause(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Testing ClientSecureChannel 1", function (this: any) {
    this.timeout(Math.max(this.timeout(), 100000));

    const options = {
        connectionStrategy: {
            maxRetry: 1,
            initialDelay: 1,
            maxDelay: 2,
            randomisationFactor: 0.1
        }
    };

    it("should not receive a close event with an error when attempting to connect to a non existent server", (done) => {
        const port = port1;
        const secureChannel = new ClientSecureChannelLayer(options);

        let client_has_received_close_event = 0;

        secureChannel.on("close", (err) => {
            should.not.exist(err);
            client_has_received_close_event += 1;
        });

        secureChannel.create(`opc.tcp://no_server_at_this_address.com:${port}/UA/Sample`, (err) => {
            should(err).be.instanceOf(Error);
            (err as Error).message.should.match(/getaddrinfo ENOTFOUND|EAI_AGAIN/);
            client_has_received_close_event.should.eql(0);
            setTimeout(done, 200);
        });
    });

    it("should not receive a close event with an error when attempting to connect to a valid server on a invalid port", (done) => {
        const secureChannel = new ClientSecureChannelLayer(options);

        let client_has_received_close_event = 0;

        secureChannel.on("close", (err) => {
            should.not.exist(err);
            client_has_received_close_event += 1;
        });

        secureChannel.create("opc.tcp://" + os.hostname() + ":8888/UA/Sample", function (err) {
            should(err).be.instanceOf(Error);
            debugLog(err?.message);
            (err as Error).message.should.match(/ECONNREFUSED|ETIMEDOUT/);
            client_has_received_close_event.should.eql(0);
            setTimeout(done, 200);
        });
    });
});
type IHolder = {
    serverChannel?: ServerSecureChannelLayer;
    tcpServer?: net.Server;
    serverChannelSocket?: net.Socket;
};


async function startServer(holder: IHolder, port: number) {

    const tcpServer = new net.Server();

    holder.tcpServer = tcpServer;

    tcpServer.listen(port);

    tcpServer.on("connection", (socket) => {
        const serverChannel = new ServerSecureChannelLayer({
            parent: null as any, // TO DO CHECK THIS
            timeout: 1000 * 1000
        });
        holder.serverChannel = serverChannel;
        serverChannel.timeout = 1000 * 1000;
        serverChannel.init(socket, () => {
            holder.serverChannelSocket = socket;
            /** */
        });
    });

}
async function stopServer(holder: IHolder) {
    simulate_server_abrupt_shutdown(holder);
    const tcpServer = holder.tcpServer;
    holder.serverChannel = undefined;
    holder.tcpServer = undefined;
    await new Promise<void>((resolve) => {
        tcpServer!.close(() => { resolve(); });
    });
}


function simulate_server_abrupt_shutdown(holder: IHolder) {
    if (holder.serverChannel && holder.serverChannelSocket) {
        holder.serverChannelSocket.end();
    }
}

describe("Testing ClientSecureChannel 2", function (this: any) {
    const port = port2;
    beforeEach(async () => {
        await startServer(this, port);
    });
    afterEach(async () => {
        await stopServer(this);
    });

    it("should establish a client secure channel ", async () => {

        const secureChannel = new ClientSecureChannelLayer({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None
        });
        secureChannel.protocolVersion.should.equal(0);
        secureChannel.on("end_transaction", (transaction_stat) => {
            debugLog("transaction_stat", transaction_stat);
        });

        const closeSpy = sinon.spy();
        secureChannel.on("close", closeSpy);

        await promisify(secureChannel.create).call(secureChannel, `opc.tcp://${os.hostname()}:${port}/UA/Sample`);

        await promisify(secureChannel.close).call(secureChannel);


        closeSpy.callCount.should.eql(1);
        should.not.exist(closeSpy.getCall(0).args[0], "expecting no error here, as secure channel has been closed normally");

    });
});

describe("Testing ClientSecureChannel with BackOff reconnection strategy", function (this: any) {
    this.timeout(Math.max(this.timeout(), 100000));

    it("WW2-a connectionStrategy: should retry many times and fail eventually ", (done) => {
        const port = port3;
        const options = {
            connectionStrategy: {
                maxRetry: 3,
                initialDelay: 10,
                maxDelay: 20,
                randomisationFactor: 0
            }
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
        let nbRetry = 0;
        secureChannel.on("backoff", function (number, delay) {
            debugLog(number + " " + delay + "ms");
            nbRetry = number + 1;
        });
        secureChannel.create(endpoint, (err) => {
            nbRetry.should.equal(options.connectionStrategy.maxRetry);
            should.exist(err, "expecting an error here");
            done();
        });
    });

    // waiting for https://github.com/MathieuTurcotte/node-backoff/issues/15 to be fixed
    it("WW2-b should be possible to interrupt the retry process  ", (done) => {
        const port = port3;
        const options = {
            connectionStrategy: {
                maxRetry: 3000,
                initialDelay: 10,
                maxDelay: 20,
                randomisationFactor: 0
            }
        };

        const secureChannel = new ClientSecureChannelLayer(options);

        const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
        let nbRetry = 0;

        secureChannel.on("backoff", function (number, delay) {
            debugLog(number + " " + delay + "ms");
            nbRetry = number + 1;
            if (number === 2) {
                debugLog("Let's abort the connection now");
                secureChannel.abortConnection(function () {
                    /** */
                });
            }
        });
        secureChannel.create(endpoint, (err) => {
            nbRetry.should.not.equal(options.connectionStrategy.maxRetry);
            nbRetry.should.be.greaterThan(2);
            nbRetry.should.be.lessThan(4);
            should.exist(err, "expecting an error here");
            debugLog("secureChannel.create failed with message ", (err as Error).message);
            secureChannel.close(function () {
                setTimeout(done, 100);
            });
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    it("WW2-c secureChannel that starts before the server is up and running should eventually connect without error", async () => {


        const port = port3;
        const options: ClientSecureChannelLayerOptions = {
            connectionStrategy: {
                maxRetry: 15,
                initialDelay: 10,
                maxDelay: 100,
                randomisationFactor: 0
            }
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
        let nbRetry = 0;

        secureChannel.on("backoff", function (number, delay) {
            debugLog("backoff ", number + " " + delay + "ms");
            nbRetry = number + 1;
        });

        const spyBackoff = sinon.spy();
        secureChannel.on("backoff", spyBackoff);

        const promiseSecureChannelClose = (async () => {
            // let's start the connection process (the server is not yet started)
            await promisify(secureChannel.create).call(secureChannel, endpoint);
            debugLog("secureChannel connected!");

            await pause(1000);
            await promisify(secureChannel.close).call(secureChannel);
            debugLog("secureChannel discconnected!");

        })();

        const promiseStartServerWithDelay = (async () => {
            await pause(6000);
            // start the server with a delay
            await startServer(test, port);
            debugLog("Server finally started !");
            await pause(2000);
            await stopServer(test)
            debugLog("Server finally stopped !");
        })();


        await promiseStartServerWithDelay;
        await promiseSecureChannelClose;

        nbRetry.should.be.greaterThan(0);
    });


    let minTransactionTimeout = ClientSecureChannelLayer.minTransactionTimeout;
    let defaultTransactionTimeout = 3 * 1000
    beforeEach(() => {
        ClientSecureChannelLayer.minTransactionTimeout = 10 * 100; // 1 sec
    });
    afterEach(() => {
        ClientSecureChannelLayer.minTransactionTimeout = minTransactionTimeout; // 1 sec
    });

    it("MMM1 client SecureChannel should detect connection problem", async () => {
        const port = port4;
        // #region create Client SecureChannel
        const options: ClientSecureChannelLayerOptions = {

            defaultTransactionTimeout,

            connectionStrategy: {
                maxRetry: 3,
                initialDelay: 10,
                maxDelay: 200,
                randomisationFactor: 0
            },
            defaultSecureTokenLifetime: 1000,
            transportTimeout: 2000
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        secureChannel.on("close", () => {
            debugLog("On close");
        });
        // #endregion

        // #region start Server
        const holder: IHolder = {};
        await startServer(holder, port);
        // #endregion

        // #region now connect the client SecureChannel to the server
        const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
        await promisify(secureChannel.create).call(secureChannel, endpoint);
        // #endregion

        //-----------------------------------------------------------------
        // #region let suspend the communication
        const oldWrite = holder.serverChannel!.write;
        assert(oldWrite !== undefined);

        let timeoutId: NodeJS.Timeout;
        assert(holder.serverChannel !== undefined);
        holder.serverChannel!.write = (chunk: Buffer) => {
            // replace standard implementation with a method
            // do not write the expected chunk to simulate very slow network or broken network
            debugLog("Not Writing chunk immediately", chunk.toString("hex"));
            timeoutId = setTimeout(() => {
                oldWrite.call(holder.serverChannel, chunk);
            }, 20 * 1000);
        };
        // #endregion
        //-----------------------------------------------------------------

        // #region now perform a transaction that will fail as the server will not answer
        const request = new ReadRequest({
            nodesToRead: [],
            timestampsToReturn: 0,
            maxAge: 0,
            requestHeader: {
                timeoutHint: 2000,
                returnDiagnostics: 0
            }
        });

        async function sendTransaction() {
            const res = await promisify(secureChannel.performMessageTransaction).call(secureChannel, request);
            debugLog(res!.toString());
        }
        // #endregion

        await sendTransaction().should.be.rejectedWith(/Connection Break|Transaction has timed out/);

         // this will cause SecurityToken to be renewed , but failed
        await pause(3000);

        // #egion repair the communication channel
        holder.serverChannel!.write = oldWrite;
        clearTimeout(timeoutId!);
        // #endregion


        try {
        await promisify(secureChannel.close).call(secureChannel);
        } catch (err) {
            console.log("Error ", (err as Error).message);
        }

        await stopServer(holder);

        debugLog("DONE! ");
    });
    it("MMM2 testing  client SecureChannel can sabotage itself when connection problem", async () => {
        const port = port5;

        const options = {
            connectionStrategy: {
                maxRetry: 3,
                initialDelay: 10,
                maxDelay: 2000,
                randomisationFactor: 0
            },
            defaultSecureTokenLifetime: 1000,
            transportTimeout: 2000
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        secureChannel.on("close", () => {
            debugLog("On close");
        });

        const holder: IHolder = {};
        await startServer(holder, port);

        try {
            const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
            await promisify(secureChannel.create).call(secureChannel, endpoint);
            secureChannel.sabotageConnection();
        } catch (err) {
            debugLog((err as Error).message);
            throw err;
        } finally {
            debugLog("Done ");
            await stopServer(holder);
        }
    });
});
