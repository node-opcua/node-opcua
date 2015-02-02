require("requirish")._(module);
var should = require("should");

var ClientSecureChannelLayer = require("lib/client/client_secure_channel_layer").ClientSecureChannelLayer;
var ServerSecureChannelLayer = require("lib/server/server_secure_channel_layer").ServerSecureChannelLayer;



describe("Testing ClientSecureChannel 1", function () {


    it("should not receive a close event with an error when attempting to connect to a non existent server", function (done) {

        var secureChannel = new ClientSecureChannelLayer();

        var client_has_received_close_event = 0;

        secureChannel.on("close", function (err) {
            client_has_received_close_event += 1;
        });

        secureChannel.create("opc.tcp://no_server_at_this_address:1234/UA/Sample", function (err) {

            should(err).be.instanceOf(Error);
            err.message.should.match(/getaddrinfo ENOTFOUND/);
            client_has_received_close_event.should.eql(0);
            setTimeout(done, 200);
        });


    });

    it("should not receive a close event with an error when attempting to connect to a valid server on a invalid port", function (done) {

        var secureChannel = new ClientSecureChannelLayer();

        var client_has_received_close_event = 0;

        secureChannel.on("close", function (err) {
            client_has_received_close_event += 1;
        });


        secureChannel.create("opc.tcp://localhost:8888/UA/Sample", function (err) {

            should(err).be.instanceOf(Error);
            err.message.should.match(/connect ECONNREFUSED/);
            client_has_received_close_event.should.eql(0);
            setTimeout(done, 200);
        });


    });

});

describe("Testing ClientSecureChannel 2", function () {

    var net = require("net");

    var serverChannel = null;
    var server_socket = null;

    function simulate_server_abrupt_shutdown() {
        if (serverChannel && serverChannel.transport._socket) {
            serverChannel.transport._socket.end();
        }

    }
    beforeEach(function (done) {

        server_socket = new net.Server();

        //xx console.log(" max connection = ", server_socket.maxConnections);

        server_socket.listen(1234);
        server_socket.on("connection", function on_connection(socket) {

            serverChannel = new ServerSecureChannelLayer();
            serverChannel.timeout = 10050;
            serverChannel.init(socket, function (err) {
                //xx console.log(" server channel is initialised");
            });
        });

        done();

    });
    afterEach(function (done) {
        simulate_server_abrupt_shutdown();
        server_socket.close(done);
        serverChannel = null;
        server_socket = null;
    });

    it("should establish a client secure channel ", function (done) {

        var secureChannel = new ClientSecureChannelLayer();

        secureChannel.protocolVersion.should.equal(0);

        secureChannel.on_transaction_completed = function(transaction_stat) {
            transaction_stat.dump();
        };

        secureChannel.on("close", function (err) {
            should(err).be.eql(null, "expecting no error here, as secure channel has been closed normally");
            //xx console.log("secure channel has ended", err);
            if (err) {
                //xx console.log(" the connection was closed by an external cause such as server shutdown");
            }
        });
        secureChannel.create("opc.tcp://localhost:1234/UA/Sample", function (err) {

            should(err).be.eql(null, "connection expected to succeed");

            secureChannel.close(function () {
                done();
            });
        });
    });

});
