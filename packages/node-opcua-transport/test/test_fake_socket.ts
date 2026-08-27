import { assert } from "node-opcua-assert";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import sinon from "sinon";
import type { ISocketLike } from "../source";
import { TransportPairDirect, TransportPairSocket } from "../test_helpers";
import type { ITransportPair } from "../test_helpers/ITransportPair";

const doDebug = false;

// One port per test. The server is rebuilt in beforeEach, and re-binding a single
// fixed port that many times loses a race under load: close() resolves only once
// every connection has ended, so the next bind can arrive before the previous
// listener has let go. That is an EADDRINUSE that moves around, and it took master
// red. installTestFor runs twice, so fifteen tests need thirty binds.
//
// Written out rather than computed: a port derived as `base + i` binds a number
// that appears nowhere, which no scanner can check for collisions.
const port1 = 5750;
const port2 = 5751;
const port3 = 5752;
const port4 = 5753;
const port5 = 5754;
const port6 = 5755;
const port7 = 5756;
const port8 = 5757;
const port9 = 5758;
const port10 = 5759;
const port11 = 5760;
const port12 = 5761;
const port13 = 5762;
const port14 = 5763;
const port15 = 5764;
const port16 = 5765;
const port17 = 5766;
const port18 = 5767;
const port19 = 5768;
const port20 = 5769;
const port21 = 5770;
const port22 = 5771;
const port23 = 5772;
const port24 = 5773;
const port25 = 5774;
const port26 = 5775;
const port27 = 5776;
const port28 = 5777;
const port29 = 5778;
const port30 = 5779;
const ports = [
    port1,
    port2,
    port3,
    port4,
    port5,
    port6,
    port7,
    port8,
    port9,
    port10,
    port11,
    port12,
    port13,
    port14,
    port15,
    port16,
    port17,
    port18,
    port19,
    port20,
    port21,
    port22,
    port23,
    port24,
    port25,
    port26,
    port27,
    port28,
    port29,
    port30
];
let portIndex = 0;

let counter = 0;
function installTestFor(Transport: new (options: { port: number }) => ITransportPair) {
    describe(`Testing behavior of  ${Transport.name}  to emulate client/server communication in tests`, () => {
        let transportPair: ITransportPair | undefined;

        let events: string[] = [];

        beforeEach((done) => {
            events = [];
            transportPair = new Transport({ port: ports[portIndex++] });
            if (!transportPair) throw new Error("internal error");
            transportPair.initialize(() => {
                if (!transportPair) throw new Error("internal error");
                assert(transportPair.client);
                assert(transportPair.server);

                (transportPair.client as unknown as { name: string }).name = `client${counter}`;
                (transportPair.server as unknown as { name: string }).name = `server${counter}`;
                counter += 1;

                doDebug && console.log("--------------------------------------------");

                transportPair.server.on("data", (_data) => events.push("server data"));
                transportPair.server.on("error", (err) => events.push(`server error ${err ? err.message : ""}`));
                transportPair.server.on("close", (hadError) => events.push(`server close ${hadError}`));
                transportPair.server.on("timeout", () => events.push("server timeout"));
                transportPair.server.on("end", () => events.push("server end"));

                transportPair.client.on("data", (_data) => events.push("client data"));
                transportPair.client.on("error", (err) => events.push(`client error ${err ? err.message : ""}`));
                transportPair.client.on("close", (hadError) => events.push(`client close ${hadError}`));
                transportPair.client.on("timeout", () => events.push("client timeout"));
                transportPair.client.on("end", () => events.push("client end"));

                done();
            });
        });
        afterEach((done) => {
            if (transportPair) {
                transportPair.shutdown(done);
                transportPair = undefined;
            }
        });

        it("FS-1 server side should receive data send by the client only", (done) => {
            if (!transportPair) throw new Error("internal error");

            transportPair.client.on("data", (data) => {
                data.toString().should.equal("Some Data");
                done();
            });
            transportPair.server.write("Some Data");
        });

        it("FS-2 client side should receive data send by the server only", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.server.on("data", (data) => {
                data.toString().should.equal("Some Data");
                done();
            });
            transportPair.client.write("Some Data");
        });

        it("FS-3 server side should receive 'end' event when connection ends  on the client side", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.server.on("end", () => {
                done();
            });
            transportPair.client.end();
        });
        it("FS-4 client side should receive 'end' event when connection ends  on the server side", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.client.on("end", () => {
                done();
            });
            transportPair.server.end();
        });

        it("FS-5 client side should receive 'end' event when connection ends  on the client side", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.client.on("end", () => {
                done();
            });
            transportPair.client.end();
        });

        it("FS-6 server side should receive 'end' event when connection ends  on the server side", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.server.on("end", () => {
                done();
            });
            transportPair.server.end();
        });

        it("FS-7 server should timeout if client doesn't send data fast enough", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.server.setTimeout(100);

            transportPair.server.on("timeout", () => {
                done();
            });
        });

        function decorateSocket(socket: ISocketLike) {
            const name = (socket as unknown as { name?: string }).name;

            socket.on("data", (data) => {
                doDebug && console.log(name, "socket received chunk", data.toString("hex"));
            });

            socket.on("error", (err) => {
                doDebug && console.log(name, "socket error", err);
            });
            socket.on("close", (hadError) => {
                doDebug && console.log(name, "socket close", hadError);
            });
            socket.on("timeout", () => {
                doDebug && console.log(name, "socket timeout");
            });
            socket.on("end", () => {
                doDebug && console.log(name, "socket end");
            });
            const spyOnClose = sinon.spy();
            const spyOnEnd = sinon.spy();
            const spyOnTimeOut = sinon.spy();
            const spyOnError = sinon.spy();
            socket.on("close", spyOnClose);
            socket.on("end", spyOnEnd);
            socket.on("timeout", spyOnTimeOut);
            socket.on("error", spyOnError);
            return { spyOnClose, spyOnEnd, spyOnTimeOut, spyOnError };
        }
        it("FS-8 server should timeout if client doesn't send data fast enough", (done) => {
            if (!transportPair) throw new Error("internal error");

            const socket = transportPair.server;
            decorateSocket(socket);

            socket.setTimeout(100);

            socket.on("timeout", () => {
                done();
            });
        });
        it("FS-9 server terminating socket on timeout - destroy", (done) => {
            if (!transportPair) throw new Error("internal error");

            const socket = transportPair.server;
            const { spyOnClose, spyOnTimeOut, spyOnEnd, spyOnError } = decorateSocket(socket);
            socket.setTimeout(100);

            socket.on("timeout", () => {
                setTimeout(() => {
                    socket.destroy();
                }, 100);
            });
            socket.on("close", () => {
                spyOnClose.callCount.should.eql(1);
                spyOnClose.getCall(0).args[0].should.eql(false);

                spyOnTimeOut.callCount.should.eql(1);
                spyOnError.callCount.should.eql(0);
                spyOnEnd.callCount.should.eql(0);
                done();
            });
        });

        it("FS-10 server terminating socket on timeout - destroy with error", (done) => {
            if (!transportPair) throw new Error("internal error");

            const socket = transportPair.server;
            const { spyOnClose, spyOnTimeOut, spyOnEnd, spyOnError } = decorateSocket(socket);
            socket.setTimeout(100);

            socket.on("timeout", () => {
                setImmediate(() => {
                    socket.destroy(new Error("some error"));
                });
            });
            socket.on("close", () => {
                spyOnClose.callCount.should.eql(1);
                spyOnClose.getCall(0).args[0].should.eql(true);

                spyOnTimeOut.callCount.should.eql(1);
                spyOnError.callCount.should.eql(1);
                spyOnEnd.callCount.should.eql(0);
                done();
            });
        });

        it("FS-11 client should timeout if server doesn't send data fast enough - destroy with error", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.client.setTimeout(100);
            const { spyOnTimeOut, spyOnEnd, spyOnError } = decorateSocket(transportPair.client);
            transportPair.client.on("timeout", () => {
                transportPair?.client.destroy(new Error("somme error"));
                //     done();
            });
            transportPair.client.on("close", () => {
                spyOnTimeOut.callCount.should.eql(1);
                spyOnError.callCount.should.eql(1);
                spyOnEnd.callCount.should.eql(0);
                done();
            });
        });
        it("FS-12 client should timeout if server doesn't send data fast enough - close", (done) => {
            if (!transportPair) throw new Error("internal error");
            transportPair.client.setTimeout(100);
            const { spyOnTimeOut, spyOnEnd, spyOnError } = decorateSocket(transportPair.client);
            transportPair.client.on("timeout", () => {
                transportPair?.client.end(); /// will raise end and close
                //     done();
            });
            transportPair.client.on("close", () => {
                spyOnTimeOut.callCount.should.eql(1);
                spyOnError.callCount.should.eql(0);
                spyOnEnd.callCount.should.eql(1);
                done();
            });
        });

        it("FS-13 server terminating socket on timeout - client should disconnect", (done) => {
            if (!transportPair) throw new Error("internal error");

            const socket = transportPair.server;
            socket.setTimeout(100);

            decorateSocket(transportPair.server);

            const {
                spyOnClose: spyOnCloseClient,
                spyOnTimeOut: spyOnTimeOutClient,
                spyOnEnd: spyOnEndClient,
                spyOnError: spyOnErrorClient
            } = decorateSocket(transportPair.client);

            socket.on("timeout", () => {
                setTimeout(() => {
                    socket.destroy(); // will raise close but no end
                }, 100);
            });
            transportPair.server.on("close", () => {
                setTimeout(() => {
                    spyOnEndClient.callCount.should.eql(1);

                    spyOnCloseClient.callCount.should.eql(1);
                    spyOnCloseClient.getCall(0).args[0].should.eql(false);

                    spyOnTimeOutClient.callCount.should.eql(0);
                    spyOnErrorClient.callCount.should.eql(0);
                    // Only the causal pair is ordered. Nothing sequences the server's
                    // close against the client's end and close - that is the event loop
                    // and the OS - so listing whole sequences means enumerating whichever
                    // interleavings a machine happens to produce, and a new legal one
                    // appears as soon as the machine is loaded differently.
                    //
                    // It was also passing two arguments to oneOf, which takes a single
                    // array of candidates, so the second was never considered at all.
                    const expected = ["server timeout", "client end", "client close false", "server close false"];
                    // exactly these four, once each, in any order
                    [...events].sort().should.eql([...expected].sort());
                    // a socket cannot close before it has ended
                    events.indexOf("client end").should.be.lessThan(events.indexOf("client close false"));
                    // the timeout is what starts the teardown
                    events.indexOf("server timeout").should.eql(0);
                    done();
                }, 10);
            });
        });
        it("FS-14 server terminating socket on timeout - client should disconnect", (done) => {
            if (!transportPair) throw new Error("internal error");

            transportPair.server.setTimeout(100);

            decorateSocket(transportPair.server);

            const {
                spyOnClose: spyOnCloseClient,
                spyOnTimeOut: spyOnTimeOutClient,
                spyOnEnd: spyOnEndClient,
                spyOnError: spyOnErrorClient
            } = decorateSocket(transportPair.client);

            transportPair.server.on("timeout", () => {
                setTimeout(() => {
                    transportPair?.server.destroy(new Error("some error")); // will raise close but no end
                }, 100);
            });
            transportPair.server.on("close", () => {
                setTimeout(() => {
                    spyOnEndClient.callCount.should.eql(1);

                    spyOnCloseClient.callCount.should.eql(1);
                    spyOnCloseClient.getCall(0).args[0].should.eql(false);

                    spyOnTimeOutClient.callCount.should.eql(0);
                    spyOnErrorClient.callCount.should.eql(0);

                    // Only the causal pairs are ordered. Nothing sequences the server's
                    // close against the client's end/close - that is the event loop and
                    // the OS - so asserting a full sequence means enumerating whichever
                    // interleavings a given machine happens to produce. That list needed
                    // a third entry under the parallel runner, which is the signal it was
                    // the wrong assertion rather than an incomplete one.
                    const expected = [
                        "server timeout",
                        "server error some error",
                        "client end",
                        "client close false",
                        "server close true"
                    ];
                    // exactly these five, once each, in any order
                    [...events].sort().should.eql([...expected].sort());
                    // the timeout handler is what destroys the server
                    events.indexOf("server timeout").should.be.lessThan(events.indexOf("server error some error"));
                    // a socket cannot close before it has ended
                    events.indexOf("client end").should.be.lessThan(events.indexOf("client close false"));
                    done();
                }, 10);
            });
        });
        it("FS-16 server terminating socket on timeout - end - client should disconnect", (done) => {
            if (!transportPair) throw new Error("internal error");

            transportPair.server.setTimeout(100);

            decorateSocket(transportPair.server);

            const {
                spyOnClose: spyOnCloseClient,
                spyOnTimeOut: spyOnTimeOutClient,
                spyOnEnd: spyOnEndClient,
                spyOnError: spyOnErrorClient
            } = decorateSocket(transportPair.client);

            transportPair.server.on("timeout", () => {
                setTimeout(() => {
                    transportPair?.server.end();
                }, 100);
            });
            transportPair.server.on("close", () => {
                spyOnEndClient.callCount.should.eql(1);

                spyOnCloseClient.callCount.should.eql(1);
                spyOnCloseClient.getCall(0).args[0].should.eql(false);

                spyOnTimeOutClient.callCount.should.eql(0);
                spyOnErrorClient.callCount.should.eql(0);

                events.should.eql(["server timeout", "client end", "client close false", "server end", "server close false"]);
                done();
            });
        });
    });
}

installTestFor(TransportPairSocket);
installTestFor(TransportPairDirect);
