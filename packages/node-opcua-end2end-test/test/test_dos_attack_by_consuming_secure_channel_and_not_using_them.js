/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 *
 */
"use strict";

Error.stackTraceLimit = Infinity;

const sinon  = require("sinon");
const should = require("should");
const async = require("async");
const path = require("path");
const _ = require("underscore");
const defer=require("delayed");

const doDebug = false;
const opcua = require("node-opcua");
const is_valid_endpointUrl = opcua.is_valid_endpointUrl;
const MessageSecurityMode = opcua.MessageSecurityMode;
const SecurityPolicy = opcua.SecurityPolicy;

const OPCUAServer = require("node-opcua-server").OPCUAServer;
const OPCUAClient = require("node-opcua-client").OPCUAClient;
const ClientSecureChannelLayer = require("node-opcua-client").ClientSecureChannelLayer;
const debugLog = require("node-opcua-debug").make_debugLog(__filename);

const fail_fast_connectionStrategy = {
    maxRetry: 0  // << NO RETRY !!
};

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing Server resilience to DOS attacks", function () {

    let server;
    let endpointUrl;
    const maxConnectionsPerEndpoint = 3;
    const maxAllowedSessionNumber = 10000; // almost no limits

    let clients = [];
    let sessions = [];
    let rejected_connections =0;

    let port = 2000;

    this.timeout(Math.max(30000, this._timeout));

    beforeEach(function (done) {

        port += 1;

        console.log(" server port = ",port);
        clients = [];
        sessions =[];
        rejected_connections =0;

        server = new OPCUAServer({
            port: port,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
            maxAllowedSessionNumber:   maxAllowedSessionNumber
            //xx nodeset_filename: empty_nodeset_filename
        });
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        server.start(function () {
            done();
        });
    });

    afterEach(function (done) {
        server.shutdown(function () {
            server = null;
            done();
        });
    });

    it("ZAA1 should be possible to create many sessions per connection",function(done){

        const client = new OPCUAClient({
            connectionStrategy: fail_fast_connectionStrategy
        });

        const sessions = [];

        function create_session(callback) {
            client.createSession(function(err,session){
                if (!err) {
                    sessions.push(session);
                }
                callback(err);
            });

        }
        async.series([

            function (callback) {
                client.connect(endpointUrl, function (err) {
                    callback();
                });
            },
            create_session,
            create_session,
            create_session,
            create_session,

            function(callback) {
                async.eachLimit(sessions,1,function(session,callback){
                    session.close(callback);
                },callback);
            },
            function(callback) {
                client.disconnect(callback);
            }
        ],done);
    });

    it("ZAA2 When creating a valid/real SecureChannel, prior unused channels should be recycled.",function(done) {


        // uncomment this line to run with external server
        //xx endpointUrl = "opc.tcp://" + os.hostname() + ":26543";

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);

        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        const channels = [];

        function step1_construct_many_channels(callback) {

            const tasks = [];

            for(let i=0;i<nbConnections;i++) { tasks.push({index: i,endpointUrl : endpointUrl});}

            function createChannel(data,_inner_callback) {


                _.isFunction(_inner_callback).should.eql(true);
                const secureChannel = new ClientSecureChannelLayer({
                    defaultSecureTokenLifetime: 5000000,
                    securityMode:               MessageSecurityMode.NONE,
                    securityPolicy:             SecurityPolicy.None,
                    serverCertificate:          null,
                    connectionStrategy: {
                        maxRetry: 0
                    }
                });
                secureChannel.create(data.endpointUrl, function (err) {
                //xx    console.log(" err ",data.index,err);
                    channels.push(secureChannel);
                    _inner_callback(err);
                });
            }

            const defer=require("delayed");
            async.eachLimit( tasks,1 , createChannel,function(err,results){
                callback(err);
            });
        }

        const results = [];
        let nbError = 0;
        function step2_close_all_channels(callback) {

            async.eachLimit(channels,1,function(channel,callback) {
                //xxconsole.log(" CLOSING =======================================".bgWhite.red,channel._transport.name);
                channel.close(function(err) {
                    if (err) {nbError ++;}
                    //xxx console.log( "closing channel....",err,channel._transport.name);
                    callback();
                });
            },callback);
        }
        function step3_verification(callback) {
            nbError.should.eql(nbExtra);
            callback();
        }
        async.series([
            step1_construct_many_channels,
            step2_close_all_channels,
            step3_verification
        ],done);

    });

    function createClientAndSession(data,_inner_callback) {

        const client = new OPCUAClient({
            connectionStrategy: fail_fast_connectionStrategy
        });
        client.connectionStrategy.maxRetry.should.eql(fail_fast_connectionStrategy.maxRetry);

        client.on("start_reconnection", function (err) {
            if(doDebug) { console.log("start_reconnection".bgWhite.yellow,data.index);}
            throw Error("Expecting automatic reconnection to be disabled");
        });
        client.on("backoff", function (number, delay) {
            if(doDebug) { console.log("backoff".bgWhite.yellow,number,delay);}
            throw Error("Expecting automatic reconnection to be disabled");
        });


        clients.push(client);
        async.series([

            function(callback) {
                client.connect(endpointUrl, function (err) {

                    if (!err) {
                        client._secureChannel.connectionStrategy.maxRetry.should.eql(fail_fast_connectionStrategy.maxRetry);

                        client.createSession(function(err,session){

                            if (!err) {
                                sessions.push(session);
                            }
                            callback();
                        });

                    } else {
                        rejected_connections ++;
                        // ignore err here
                        callback();
                    }
                });
            }
        ],_inner_callback);
    }

    it("ZAA3 server should reject connections if all secure channels are used",function(done){

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        rejected_connections.should.eql(0);
        clients.length.should.eql(0);
        sessions.length.should.eql(0);
        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        function step1_construct_many_channels_with_session(callback) {

            const tasks = [];

            for(let i=0;i<nbConnections;i++) {
                tasks.push({index: i,endpointUrl : endpointUrl});
            }

            const defer=require("delayed");
            async.eachLimit( tasks,1 , defer.deferred(createClientAndSession),function(err,results){
                callback(err);
            });
        }

        let nbError = 0;

        function step2_close_all_sessions(callback) {
            async.eachLimit(sessions,2,function(session,callback) {
                // some channel have been forcibly closed by the server, closing them will cause server to generate an errpr
                session.close(function(err) {
                    if (err) {nbError ++;}
                    callback();
                });
            },callback);

        }
        function step2_close_all_clients(callback) {

            async.eachLimit(clients,1,function(client,callback) {
                // some channel have been forcibly closed by the server, closing them will cause server to generate an errpr
                client.disconnect(function(err) {
                    if (err) {nbError ++;}
                    callback();
                });
            },callback);
        }

        function step3_verification(callback) {
            try {

                nbError.should.eql(0,"");

                rejected_connections.should.eql(5);
                sessions.length.should.eql(server.maxConnectionsPerEndpoint);
            }
            catch(err) {
                return callback(err);
            }
            callback();
        }

        async.series([
            step1_construct_many_channels_with_session,
            step2_close_all_sessions,
            step2_close_all_clients,
            step3_verification
        ],done);
    });

    it("ZAA4 Server shall not keep channel that have been disconnected abruptly",function(done) {

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        rejected_connections.should.eql(0);
        clients.length.should.eql(0);
        sessions.length.should.eql(0);

        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        function step1_construct_many_channels_with_session_and_abruptly_terminate_them(callback) {

            const tasks = [];

            for(let i=0;i<nbConnections;i++) {
                tasks.push({index: i,endpointUrl : endpointUrl});
            }
            async.eachLimit( tasks,1 , defer.deferred(createClientAndSession),function(err,results){
                callback(err);
            });
        }
        function step2_abruptly_disconnect_existing_channel_from_client_side(callback) {

            function terminate_client_abruptly(client,inner_callback) {
                if (client._secureChannel){
                    const socket = client._secureChannel._transport._socket;
                    socket.end();
                    socket.destroy();
                    socket.emit("error", new Error("Terminate"));
                }
                inner_callback();
            }
            async.eachLimit(clients,1,terminate_client_abruptly,function(err,results) {
                callback(err);
            });
        }
        async.series([
            step1_construct_many_channels_with_session_and_abruptly_terminate_them,
            step2_abruptly_disconnect_existing_channel_from_client_side,
            function(callback) {
                rejected_connections.should.eql(5);
                callback();
            },
            step1_construct_many_channels_with_session_and_abruptly_terminate_them,
            function(callback) {
                rejected_connections.should.eql(10);
                callback();
            },
            function cleanup(callback) {
                async.eachLimit(clients,1,function(client,inner_done){ client.disconnect(inner_done);},callback);
            }
        ],done);

    });

    it("ZAA5 Server shall not keep channel that have been disconnected abruptly - version 2",function(done) {


        const serverEndpoint =server.endpoints[0];

        const spyCloseChannel = new sinon.spy();
        const spyNewChannel = new sinon.spy();

        serverEndpoint.on("closeChannel",spyCloseChannel);
        serverEndpoint.on("newChannel",spyNewChannel);


        let counter = 0;
        function create_crashing_client(callback) {

            counter ++;
            console.log(" ------------------------------------------------------------ > create_a_faulty_client");
            const spawn = require("child_process").spawn;
            const server_script  = path.join(__dirname,"../test_helpers/crashing_client");
            const options ={};
            const server_exec = spawn("node", [server_script,  port], options);

            server_exec.on("close",function(code){
                console.log("terminated with ",code);
                callback();
            });
            server_exec.stdout.on("data", function (data) {
                data = data.toString();
                data.split("\n").forEach(function(data){
                    process.stdout.write("stdout:               "+data.yellow + "\n");
                });
            });
        }

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        clients.length.should.eql(0);
        sessions.length.should.eql(0);


        function step1_launch_crashing_client(callback) {
            create_crashing_client(callback);
        }
        function verify_server_channel_count(callback) {

            setTimeout(function() {

                // verify that there are no channel opened on the server.
                console.log(" currentChannelCount = ",serverEndpoint.currentChannelCount);
                serverEndpoint.currentChannelCount.should.eql(0);

                spyNewChannel.callCount.should.eql(counter,"expecting spyNewChannel to have been called");
                spyCloseChannel.callCount.should.eql(counter,"expecting spyCloseChannel to have been called");
                callback();
            },250);
        }
        async.series([
            verify_server_channel_count,
            step1_launch_crashing_client,
            verify_server_channel_count,
            step1_launch_crashing_client,
            verify_server_channel_count,
            step1_launch_crashing_client,
            verify_server_channel_count,
            step1_launch_crashing_client,
            verify_server_channel_count
        ],done);

    });

});
