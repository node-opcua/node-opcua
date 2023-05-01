import * as should from "should";
import * as sinon from "sinon";
import { assert } from "node-opcua-assert";
import { TransportPairDirect, TransportPairSocket } from "../test_helpers";
import { ITransportPair } from "../test_helpers/ITransportPair";
import { ISocketLike } from "../source";

const doDebug = false;
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

const port = 5879;

let counter = 0;
function installTestFor(Transport: any) {
    describe("Testing behavior of  " + Transport.name + "  to emulate client/server communication in tests", function () {
        let transportPair: ITransportPair | undefined = undefined;

        let events: string[] = [];

        beforeEach(function (done) {
            events = [];
            transportPair = new Transport({ port });
            if (!transportPair) throw new Error("internal error");
            transportPair.initialize(() => {
                if (!transportPair) throw new Error("internal error");
                assert(transportPair.client);
                assert(transportPair.server);

                (transportPair.client as any).name = "client" + counter;
                (transportPair.server as any).name = "server" + counter;
                counter += 1;

                doDebug && console.log("--------------------------------------------");

                transportPair.server.on("data", (data) => events.push("server data"));
                transportPair.server.on("error", (err) => events.push("server error " + (err ? err.message : "")));
                transportPair.server.on("close", (hadError) => events.push("server close " + hadError));
                transportPair.server.on("timeout", () => events.push("server timeout"));
                transportPair.server.on("end", () => events.push("server end"));

                transportPair.client.on("data", (data) => events.push("client data"));
                transportPair.client.on("error", (err) => events.push("client error " + (err ? err.message : "")));
                transportPair.client.on("close", (hadError) => events.push("client close " + hadError));
                transportPair.client.on("timeout", () => events.push("client timeout"));
                transportPair.client.on("end", () => events.push("client end"));

                done();
            });
        });
        afterEach(function (done) {
            if (transportPair) {
                transportPair.shutdown(done);
                transportPair = undefined;
            }
        });

        it("FS-1 server side should receive data send by the client only", function (done) {
            if (!transportPair) throw new Error("internal error");

            transportPair.client.on("data", (data) => {
                data.toString().should.equal("Some Data");
                done();
            });
            transportPair.server.write("Some Data");
        });

        it("FS-2 client side should receive data send by the server only", function (done) {
            if (!transportPair) throw new Error("internal error");
            transportPair.server.on("data", (data) => {
                data.toString().should.equal("Some Data");
                done();
            });
            transportPair.client.write("Some Data");
        });

        it("FS-3 server side should receive 'end' event when connection ends  on the client side", function (done) {
            if (!transportPair) throw new Error("internal error");
            transportPair.server.on("end", () => {
                done();
            });
            transportPair.client.end();
        });
        it("FS-4 client side should receive 'end' event when connection ends  on the server side", function (done) {
            if (!transportPair) throw new Error("internal error");
            transportPair.client.on("end", () => {
                done();
            });
            transportPair.server.end();
        });

        it("FS-5 client side should receive 'end' event when connection ends  on the client side", function (done) {
            if (!transportPair) throw new Error("internal error");
            transportPair.client.on("end", () => {
                done();
            });
            transportPair.client.end();
        });

        it("FS-6 server side should receive 'end' event when connection ends  on the server side", function (done) {
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
            const name = (socket as any).name;

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
            const { spyOnClose, spyOnTimeOut, spyOnEnd, spyOnError } = decorateSocket(transportPair.client);
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
            const { spyOnClose, spyOnTimeOut, spyOnEnd, spyOnError } = decorateSocket(transportPair.client);
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

            const {
                spyOnClose: spyOnCloseServer,
                spyOnTimeOut: spyOnTimeOutServer,
                spyOnEnd: spyOnEndServer,
                spyOnError: spyOnErrorServer
            } = decorateSocket(transportPair.server);

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
                spyOnEndClient.callCount.should.eql(1);

                spyOnCloseClient.callCount.should.eql(1);
                spyOnCloseClient.getCall(0).args[0].should.eql(false);

                spyOnTimeOutClient.callCount.should.eql(0);
                spyOnErrorClient.callCount.should.eql(0);
                events.should.eql(["server timeout", "client end", "client close false", "server close false"]);
                done();
            });
        });
        it("FS-14 server terminating socket on timeout - client should disconnect", (done) => {
            if (!transportPair) throw new Error("internal error");

            transportPair.server.setTimeout(100);

            const {
                spyOnClose: spyOnCloseServer,
                spyOnTimeOut: spyOnTimeOutServer,
                spyOnEnd: spyOnEndServer,
                spyOnError: spyOnErrorServer
            } = decorateSocket(transportPair.server);

            const {
                spyOnClose: spyOnCloseClient,
                spyOnTimeOut: spyOnTimeOutClient,
                spyOnEnd: spyOnEndClient,
                spyOnError: spyOnErrorClient
            } = decorateSocket(transportPair.client);

            transportPair.server.on("timeout", () => {
                setTimeout(() => {
                    transportPair!.server.destroy(new Error("some error")); // will raise close but no end
                }, 100);
            });
            transportPair.server.on("close", () => {
                spyOnEndClient.callCount.should.eql(1);

                spyOnCloseClient.callCount.should.eql(1);
                spyOnCloseClient.getCall(0).args[0].should.eql(false);

                spyOnTimeOutClient.callCount.should.eql(0);
                spyOnErrorClient.callCount.should.eql(0);

                events.should.eql([
                    "server timeout",
                    "server error some error",
                    "client end",
                    "client close false",
                    "server close true"
                ]);
                done();
            });
        });
        it("FS-16 server terminating socket on timeout - end - client should disconnect", (done) => {
            if (!transportPair) throw new Error("internal error");

            transportPair.server.setTimeout(100);

            const {
                spyOnClose: spyOnCloseServer,
                spyOnTimeOut: spyOnTimeOutServer,
                spyOnEnd: spyOnEndServer,
                spyOnError: spyOnErrorServer
            } = decorateSocket(transportPair.server);

            const {
                spyOnClose: spyOnCloseClient,
                spyOnTimeOut: spyOnTimeOutClient,
                spyOnEnd: spyOnEndClient,
                spyOnError: spyOnErrorClient
            } = decorateSocket(transportPair.client);

            transportPair.server.on("timeout", () => {
                setTimeout(() => {
                    transportPair!.server.end();
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
