/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 *
 */

require("requirish")._(module);
Error.stackTraceLimit = Infinity;



var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
var OPCUAClient = require("lib/client/opcua_client").OPCUAClient;
var ClientSecureChannelLayer = require("lib/client/client_secure_channel_layer").ClientSecureChannelLayer;

var should = require("should");
var async = require("async");
var util = require("util");

var opcua = require("index");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var _ = require("underscore");

var empty_nodeset_filename = require("path").join(__dirname, "./fixtures/fixture_empty_nodeset2.xml");

var fail_fast_connectionStrategy = {
    maxRetry: 0  // << NO RETRY !!
};

describe("testing Server resilience to DOS attacks", function () {

    var server;
    var endpointUrl;
    var maxConnectionsPerEndpoint = 3;
    var maxAllowedSessionNumber = 10000; // almost no limits

    this.timeout(Math.max(20000, this._timeout));

    beforeEach(function (done) {

        server = new OPCUAServer({
            port: 2000,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
            maxAllowedSessionNumber:   maxAllowedSessionNumber,
            nodeset_filename: empty_nodeset_filename
        });
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        debugLog("endpointUrl", endpointUrl);
        opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

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

    it("ZZZ should be possible to create many sessions per connection",function(done){

        var client = new OPCUAClient({
            connectionStrategy: fail_fast_connectionStrategy
        });

        var sessions = [];

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
    it("When creating a valid/real SecureChannel, prior unused channels should be recycled.",function(done) {


        // uncomment this line to run with external server
        //xx endpointUrl = "opc.tcp://localhost:26543";

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);

        var nbExtra = 5;
        var nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        var channels = [];

        function step1_construct_many_channels(callback) {

            var tasks = [];

            for(var i=0;i<nbConnections;i++) { tasks.push({index: i,endpointUrl : endpointUrl});}

            function createChannel(data,_inner_callback) {

                _.isFunction(_inner_callback).should.eql(true);
                var secureChannel = new ClientSecureChannelLayer({
                    defaultSecureTokenLifetime: 5000000,
                    securityMode:               opcua.MessageSecurityMode.NONE,
                    securityPolicy:             opcua.SecurityPolicy.None,
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

            var defer=require("delayed");
            async.eachLimit( tasks,1 , createChannel,function(err,results){
                callback(err);
            });
        }

        var results = [];
        var nbError = 0;
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

    it("QQQQ should reject connections if all secure channel are used",function(done){

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);

        var nbExtra = 5;
        var nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        var channels = [];
        var clients = [];
        var sessions = [] ;


        var doDebug = true;

        var rejected_connections =0;
        function step1_construct_many_channels_with_session(callback) {

            var tasks = [];

            for(var i=0;i<nbConnections;i++) {
                tasks.push({index: i,endpointUrl : endpointUrl});
            }

            function createClientAndSession(data,_inner_callback) {

                var client = new OPCUAClient({
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

                async.series([

                    function(callback) {
                        client.connect(endpointUrl, function (err) {
                            if (!err) {
                                client._secureChannel.connectionStrategy.maxRetry.should.eql(fail_fast_connectionStrategy.maxRetry);
                                clients.push(client);

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

            var defer=require("delayed");
            async.eachLimit( tasks,1 , createClientAndSession,function(err,results){
                callback(err);
            });
        }

        var results = [];
        var nbError = 0;

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

                clients.length.should.eql(server.maxConnectionsPerEndpoint);
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
});
