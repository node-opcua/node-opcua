import os from "os";
import net from "net";
import { promisify } from "util";
import sinon from "sinon";
import should from "should";
import { MessageSecurityMode, ReadRequest } from "node-opcua-types";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";

import { ClientSecureChannelLayer, SecurityPolicy, ServerSecureChannelLayer } from "../dist/source";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port1 = 2043;
const port2 = 2044;
const port3 = 2045;
const port4 = 2046;
const port5 = 2047;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
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
            console.log(err);
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
function startServer(holder: IHolder, port: number, callback: (err?: Error) => void) {
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

    callback();
}

function simulate_server_abrupt_shutdown(holder: IHolder) {
    if (holder.serverChannel && holder.serverChannelSocket) {
        holder.serverChannelSocket.end();
    }
}
function stopServer(holder: IHolder, callback: (err?: Error) => void) {
    simulate_server_abrupt_shutdown(holder);
    holder.tcpServer!.close(callback);
    holder.serverChannel = undefined;
    holder.tcpServer = undefined;
}

describe("Testing ClientSecureChannel 2", function (this: any) {
    const port = port2;
    beforeEach((done) => {
        startServer(this, port, done);
    });
    afterEach((done) => {
        stopServer(this, done);
    });

    it("should establish a client secure channel ", async () => {

        const secureChannel = new ClientSecureChannelLayer({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None
        });
        secureChannel.protocolVersion.should.equal(0);
        secureChannel.on("end_transaction", (transaction_stat) => {
            console.log("transaction_stat", transaction_stat);
        });

        const closeSpy = sinon.spy();
        secureChannel.on("close", closeSpy);
        
        await promisify(secureChannel.create).call(secureChannel,`opc.tcp://${os.hostname()}:${port}/UA/Sample`);
        
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
            console.log(number + " " + delay + "ms");
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

    it("WW2-c secureChannel that starts before the server is up and running should eventually connect without error", (done) => {
        const port = port3;
        const options = {
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
            debugLog(number + " " + delay + "ms");
            nbRetry = number + 1;
        });

        //
        secureChannel.create(endpoint, (err) => {
            should(!err).be.eql(true, "expecting NO error here");
            setTimeout(function () {
                stopServer(test, function () {
                    secureChannel.close(function () {
                        done();
                    });
                });
            }, 1000);
        });

        setTimeout(function () {
            // start the server with a delay
            startServer(test, port, function () {
                debugLog("Server finally started !");
            });
        }, 5000);
    });

    async function pause(ms: number) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    let minTransactionTimeout = ClientSecureChannelLayer.minTransactionTimeout;
    let defaultTransactionTimeout = 3*1000
    beforeEach(() => {
        ClientSecureChannelLayer.minTransactionTimeout = 10 * 100; // 1 sec
    });
    afterEach(() => {
        ClientSecureChannelLayer.minTransactionTimeout = minTransactionTimeout; // 1 sec
    });

    it("MMM1 client SecureChannel should detect connection problem", async () => {
        const port = port4;
        const options = {
            
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

        const holder: any = {};

        await promisify(startServer)(holder, port);

        const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
        await promisify(secureChannel.create).call(secureChannel, endpoint);

        //-----------------------------------------------------------------
        // let suspend the communication
        const oldWrite = holder.serverChannel.write;
        debugLog();
        holder.serverChannel.write = (chunk: Buffer) => {
            // replace standard implementation with a method
            // do not write the expected chunk to simulate very slow network or broken network
            debugLog("Not Writing !!!", chunk.toString("hex"));
            setTimeout(() => {
                oldWrite.call(holder.serverChannel, chunk);
            }, 20 * 1000);
        };
        //-----------------------------------------------------------------

        const request = new ReadRequest();

        async function sendTransaction() {
            const res = await promisify(secureChannel.performMessageTransaction).call(secureChannel, request);
            debugLog(res!.toString());
        }
        await sendTransaction().should.be.rejectedWith(/Connection Break|Transaction has timed out/);

        await pause(10000);

        async function closeChannel() {
            await promisify(secureChannel.close).call(secureChannel);
        }

        if (false) {
            await closeChannel(); // .should.be.rejectedWith(/Transport disconnected/);
        }
        await promisify(stopServer)(holder);

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
        await promisify(startServer)(holder, port);

        try {
            const endpoint = `opc.tcp://${os.hostname()}:${port}/UA/Sample`;
            await promisify(secureChannel.create).call(secureChannel, endpoint);
            secureChannel.sabotageConnection();
        } catch (err) {
            console.log((err as Error).message);
            throw err;
        } finally {
            debugLog("Done ");
            await promisify(stopServer)(holder);
        }
    });
});
