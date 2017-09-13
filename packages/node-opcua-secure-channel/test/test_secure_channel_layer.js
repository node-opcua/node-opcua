"use strict";

var should = require("should");

var ClientSecureChannelLayer = require("../src/client/client_secure_channel_layer").ClientSecureChannelLayer;
var ServerSecureChannelLayer = require("../src/server/server_secure_channel_layer").ServerSecureChannelLayer;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing ClientSecureChannel 1", function () {

    this.timeout(Math.max(this._timeout, 100000));

    var options = {
        connectionStrategy: {
            maxRetry: 1,
            initialDelay:1,
            maxDelay:    2,
            randomisationFactor: 0.1
        }
    };

    it("should not receive a close event with an error when attempting to connect to a non existent server", function (done) {

        var secureChannel = new ClientSecureChannelLayer(options);

        var client_has_received_close_event = 0;

        secureChannel.on("close", function (err) {
            should(err).eql(null);
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

        var secureChannel = new ClientSecureChannelLayer(options);

        var client_has_received_close_event = 0;

        secureChannel.on("close", function (err) {
            should(err).eql(null);
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


function startServer(holder,callback) {

    var net = require("net");
    var server_socket = new net.Server();
    holder.server_socket = server_socket;

    //xx console.log(" max connection = ", server_socket.maxConnections);

    server_socket.listen(1234);
    server_socket.on("connection", function on_connection(socket) {

        var serverChannel = new ServerSecureChannelLayer();
        holder.serverChannel = serverChannel;
        serverChannel.timeout = 10050;
        serverChannel.init(socket, function () {
            //xx console.log(" server channel is initialised");
        });
    });

    callback();
}
function simulate_server_abrupt_shutdown(holder) {
    if (holder.serverChannel && holder.serverChannel.transport._socket) {
        holder.serverChannel.transport._socket.end();
    }
}
function stopServer(holder,callback) {
    simulate_server_abrupt_shutdown(holder);
    holder.server_socket.close(callback);
    holder.serverChannel = null;
    holder.server_socket = null;
}
describe("Testing ClientSecureChannel 2", function () {


    beforeEach(function (done) {
        startServer(this,done);
    });
    afterEach(function (done) {
        stopServer(this,done);
    });

    it("should establish a client secure channel ", function (done) {

        var secureChannel = new ClientSecureChannelLayer({});

        secureChannel.protocolVersion.should.equal(0);

        secureChannel.on_transaction_completed = function (transaction_stat) {
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



describe("Testing ClientSecureChannel with BackOff reconnection strategy", function () {

    this.timeout(Math.max(this._timeout, 100000));

    it("WW2-a connectionStrategy: should retry many times and fail eventually ",function(done) {

        var options = {
            connectionStrategy: {
                maxRetry: 3,
                initialDelay:10,
                maxDelay:    20,
                randomisationFactor: 0.1,
            }
        };
        var secureChannel = new ClientSecureChannelLayer(options);

        var endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        var nbRetry =0;
        secureChannel.on("backoff",function(number,delay){
            console.log(number + " " + delay + "ms");
            nbRetry = number+1;
        });
        secureChannel.create(endpoint,function(err){
            nbRetry.should.equal(options.connectionStrategy.maxRetry );
            should.exist(err, "expecting an error here");
            done();
        });


    });

    // waiting for https://github.com/MathieuTurcotte/node-backoff/issues/15 to be fixed
    it("WW2-b should be possible to interrupt the retry process  ",function(done) {

        var options = {
            connectionStrategy: {
                maxRetry:     3000,
                initialDelay: 10,
                maxDelay:     20,
                randomisationFactor: 0
            }
        };

        var secureChannel = new ClientSecureChannelLayer(options);

        var endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        var nbRetry =0;

        secureChannel.on("backoff",function(number,delay){
            console.log(number + " " + delay + "ms");
            nbRetry = number+1;
            if (number === 2) {
                console.log("Let's abort the connection now");
                secureChannel.abortConnection(function() {});
            }
        });
        secureChannel.create(endpoint,function(err){
            nbRetry.should.not.equal(options.connectionStrategy.maxRetry);
            nbRetry.should.be.greaterThan(2);
            nbRetry.should.be.lessThan(4);
            should.exist(err,"expecting an error here");
            console.log("secureChannel.create failed with message ",err.message);
            secureChannel.close(function() {
                setTimeout(done,100);
            });
        });
    });

    var test = this;
    it("WW2-c secureChannel that starts before the server is up and running should eventually connect without error",function(done) {


        var options = {
            connectionStrategy: {
                maxRetry:     3000,
                initialDelay: 10,
                maxDelay:     2000,
                randomisationFactor: 0
            }
        };

        var secureChannel = new ClientSecureChannelLayer(options);

        var endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        var nbRetry =0;

        secureChannel.on("backoff",function(number,delay){
            console.log(number + " " + delay + "ms");
            nbRetry = number+1;
        });

        //
        secureChannel.create(endpoint,function(err){
            should(err).be.eql(null, "expecting NO error here");
            setTimeout(function() {
                stopServer(test,function() {

                    secureChannel.close(function() {
                        done();
                    });
                });
            },1000);
        });

        setTimeout(function(){
            // start the server with a delay
            startServer(test,function(){
                console.log("Server finally started !");
            });
        },5000);



    });



});
