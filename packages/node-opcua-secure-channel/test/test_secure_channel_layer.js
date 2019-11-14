"use strict";

const should = require("should");
const { promisify } = require("util");

const ClientSecureChannelLayer = require("..").ClientSecureChannelLayer;
const ServerSecureChannelLayer = require("..").ServerSecureChannelLayer;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const { ReadRequest } = require("node-opcua-types");

describe("Testing ClientSecureChannel 1", function () {

    this.timeout(Math.max(this._timeout, 100000));

    const options = {
        connectionStrategy: {
            maxRetry: 1,
            initialDelay:1,
            maxDelay:    2,
            randomisationFactor: 0.1
        }
    };

    it("should not receive a close event with an error when attempting to connect to a non existent server", function (done) {

        const secureChannel = new ClientSecureChannelLayer(options);

        let client_has_received_close_event = 0;

        secureChannel.on("close", function (err) {
            should.not.exist(err);
            client_has_received_close_event += 1;
        });

        secureChannel.create("opc.tcp://no_server_at_this_address.com:1234/UA/Sample", function (err) {
            should(err).be.instanceOf(Error);
            err.message.should.match(/getaddrinfo ENOTFOUND|EAI_AGAIN/);
            client_has_received_close_event.should.eql(0);
            setTimeout(done, 200);
        });


    });

    it("should not receive a close event with an error when attempting to connect to a valid server on a invalid port", function (done) {

        const secureChannel = new ClientSecureChannelLayer(options);

        let client_has_received_close_event = 0;

        secureChannel.on("close", function (err) {
            should.not.exist(err);
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

    const net = require("net");
    const server_socket = new net.Server();
    holder.server_socket = server_socket;

    //xx console.log(" max connection = ", server_socket.maxConnections);

    server_socket.listen(1234);
    server_socket.on("connection", function on_connection(socket) {

        const serverChannel = new ServerSecureChannelLayer({
            timeout: 1000*1000,
        });
        holder.serverChannel = serverChannel;
        serverChannel.timeout = 1000*1000;
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

        const secureChannel = new ClientSecureChannelLayer({});

        secureChannel.protocolVersion.should.equal(0);

        secureChannel.on_transaction_completed = function (transaction_stat) {

            should.exist(transaction_stat.request);
            should.exist(transaction_stat.response);
            // xx console.log(transaction_stat);
        };

        secureChannel.on("close", function (err) {
            should(!err).be.eql(true, "expecting no error here, as secure channel has been closed normally");
            //xx console.log("secure channel has ended", err);
            if (err) {
                //xx console.log(" the connection was closed by an external cause such as server shutdown");
            }
        });
        secureChannel.create("opc.tcp://localhost:1234/UA/Sample", function (err) {

            should(!err).be.eql(true, "connection expected to succeed");

            secureChannel.close(function () {
                done();
            });
        });
    });

});



describe("Testing ClientSecureChannel with BackOff reconnection strategy", function () {

    this.timeout(Math.max(this._timeout, 100000));

    it("WW2-a connectionStrategy: should retry many times and fail eventually ",function(done) {

        const options = {
            connectionStrategy: {
                maxRetry: 3,
                initialDelay:10,
                maxDelay:    20,
                randomisationFactor: 0.1,
            }
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        const endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        let nbRetry =0;
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

        const options = {
            connectionStrategy: {
                maxRetry:     3000,
                initialDelay: 10,
                maxDelay:     20,
                randomisationFactor: 0
            }
        };

        const secureChannel = new ClientSecureChannelLayer(options);

        const endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        let nbRetry =0;

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

    const test = this;
    it("WW2-c secureChannel that starts before the server is up and running should eventually connect without error",function(done) {


        const options = {
            connectionStrategy: {
                maxRetry:     3000,
                initialDelay: 10,
                maxDelay:     2000,
                randomisationFactor: 0
            }
        };

        const secureChannel = new ClientSecureChannelLayer(options);

        const endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        let nbRetry =0;

        secureChannel.on("backoff",function(number,delay){
            console.log(number + " " + delay + "ms");
            nbRetry = number+1;
        });

        //
        secureChannel.create(endpoint,function(err){
            should(!err).be.eql(true, "expecting NO error here");
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

    async function pause(ms) {
        await new Promise((resolve)=> setTimeout(resolve,ms));
    }
    let minTransactionTimeout = ClientSecureChannelLayer.minTransactionTimeout ;
    let defaultTransactionTimeout = ClientSecureChannelLayer.defaultTransactionTimeout ;
    beforeEach(()=> {
        ClientSecureChannelLayer.minTransactionTimeout = 10 * 100;    // 1 sec
        ClientSecureChannelLayer.defaultTransactionTimeout = 30 * 100; // 3 sec
    });
    afterEach(()=> {
        ClientSecureChannelLayer.minTransactionTimeout = minTransactionTimeout;    // 1 sec
        ClientSecureChannelLayer.defaultTransactionTimeout =defaultTransactionTimeout; // 6minute
    });

    it("MMM1 client SecureChannel should detect connection problem",async() => {

        const options = {
            connectionStrategy: {
                maxRetry:     3,
                initialDelay: 10,
                maxDelay:     2000,
                randomisationFactor: 0
            },
            defaultSecureTokenLifetime: 1000,
            transportTimeout: 2000,
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        secureChannel.on("close",()=>{
            console.log("On close");
        });

        const holder = {};
        
        await promisify(startServer)(holder);

        const endpoint  = "opc.tcp://localhost:1234/UA/Sample";
        await promisify(secureChannel.create).call(secureChannel,endpoint);


        //-----------------------------------------------------------------
        // let suspend the communication
        const oldWrite = holder.serverChannel.transport.write;
        console.log()
        holder.serverChannel.transport.write = (chunk) => {
            // replace standard implementation with a method
            // do not write the expected chunk to simulate very slow network or broken network
            console.log("Not Writing !!!", chunk.toString("hex"));
        };
        //-----------------------------------------------------------------

        const request = new ReadRequest();

        async function sendTransaction() {
            const res = await promisify(secureChannel.performMessageTransaction).call(secureChannel, request);
            console.log(res.toString());    
        }
        await sendTransaction().should.be.rejectedWith(/Connection Break|Transaction has timed out/);

        await pause(10000);

        async function closeChannel() {
            console.log("xxxxxxxxxxxxxxxxx Now closing channel");
            await promisify(secureChannel.close).call(secureChannel);
        }
        await closeChannel().should.be.rejectedWith(/Transport disconnected/);

        await promisify(stopServer)(holder);
 
        console.log("DONE! ");

    });
    it("MMM2 testing if client SecureChannel could  sabotage itself when connection problem",async() => {
 
        const options = {
            connectionStrategy: {
                maxRetry:     3,
                initialDelay: 10,
                maxDelay:     2000,
                randomisationFactor: 0
            },
            defaultSecureTokenLifetime: 1000,
            transportTimeout: 2000,
        };
        const secureChannel = new ClientSecureChannelLayer(options);

        secureChannel.on("close",()=>{
            console.log("On close");
        });

        const holder = {};       
        await promisify(startServer)(holder);

        try  {
            const endpoint  = "opc.tcp://localhost:1234/UA/Sample";
            await promisify(secureChannel.create).call(secureChannel,endpoint);
    
            await promisify(secureChannel.closeWithError).call(secureChannel,new Error("Sabotage"));
    
        } catch(err) {
            throw err;
        } finally {
            console.log("Done ");
            await promisify(stopServer)(holder);    
        }
        

    });
});
