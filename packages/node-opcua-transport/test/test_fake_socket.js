
var DirectTransport = require("../test_helpers/fake_socket").DirectTransport;
var SocketTransport = require("../test_helpers/fake_socket").SocketTransport;

var should = require("should");
var assert = require("node-opcua-assert");


function installTestFor(Transport) {

    describe("Testing behavior of  " + Transport.name + "  to emulate client/server communication in tests", function () {

        var transport = null;

        beforeEach(function (done) {
            transport = new Transport(function () {
                assert(transport.client);
                assert(transport.server);
                done();
            });
        });
        afterEach(function (done) {
            transport.shutdown(done);
            transport = null;
        });

        it("server side should receive data send by the client only", function (done) {

            transport.client.on("data", function (data) {
                data.toString().should.equal("Some Data");
                done();
            });
            transport.server.write("Some Data");
        });

        it("client side should receive data send by the server only", function (done) {
            transport.server.on("data", function (data) {
                data.toString().should.equal("Some Data");
                done();
            });
            transport.client.write("Some Data");
        });


        it("server side should receive 'end' event when connection ends  on the client side", function (done) {

            transport.server.on("end", function (err) {
                should.not.exist(err);
                done();
            });
            transport.client.end();

        });
        it("client side should receive 'end' event when connection ends  on the server side", function (done) {

            transport.client.on("end", function (err) {
                should.not.exist(err);
                done();
            });
            transport.server.end();

        });

        it("client side should receive 'end' event when connection ends  on the client side", function (done) {

            transport.client.on("end", function (err) {
                should.not.exist(err);
                done();
            });
            transport.client.end();

        });

        it("server side should receive 'end' event when connection ends  on the server side", function (done) {

            transport.server.on("end", function (err) {
                should.not.exist(err);
                done();
            });
            transport.server.end();

        });


    });
}

installTestFor(SocketTransport);
installTestFor(DirectTransport);

