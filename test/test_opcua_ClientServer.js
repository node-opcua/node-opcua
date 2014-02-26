var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../lib/nodeopcua");

var debugLog  = require("../lib/utils").make_debugLog(__filename);
var StatusCodes = require("../lib/opcua_status_code").StatusCodes;

function is_valid_endpointUrl(endpointUrl) {
    var e = opcua.parseEndpointUrl(endpointUrl);
    if (e.hasOwnProperty("hostname")) {
        return true;
    }
    return false;
}

describe("testing basic Client-Server communication",function() {

    var server , client;
    var endpointUrl ;
    beforeEach(function(done){

        server = new OPCUAServer();
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        client = new OPCUAClient();

        server.start(function() {
            setImmediate(done);
        });


    });

    afterEach(function(done){

        server.shutdown(function() {
            done();
        });

    });

    it("should start a server and accept a connection",function(done){

        server.connected_client_count.should.equal(0);

        client.protocolVersion = 1;

        async.series([
            function(callback) {
                client.connect(endpointUrl,callback);
            },
            function(callback) {
                client.disconnect(callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);

    });

    it("Server should not accept connection, if protocol version is incompatible",function(done){

        client.protocolVersion = 55555; // set a invalid protocol version
        server.connected_client_count.should.equal(0);

        async.series([
            function(callback) {
                debugLog(" connect");
                client.connect(endpointUrl,function(err){

                    debugLog(" Error =".yellow.bold,err);
                    callback(err);
                });
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],function(err) {
            server.connected_client_count.should.equal(0);
            debugLog(" error : ", err);
            server.shutdown(done);
        });

    });

    it("Client shall be able to create a session with a anonymous token",function(done){

        server.connected_client_count.should.equal(0);

        var g_session ;
        async.series([
            function(callback) {
                debugLog(" connect");
                client.connect(endpointUrl,function(err){
                    debugLog(" Error =".yellow.bold,err);
                    callback(err);
                });
            },
            function(callback) {
                debugLog(" createSession");
                client.createSession(function(err,session){
                    g_session = session;
                    debugLog(" Error =".yellow.bold,err);
                    client.transactionInProgress.should.equal(false);
                    callback(err);
                });
                client.transactionInProgress.should.equal(true);
            },
            function(callback) {
                debugLog("closing session");
                g_session.close(callback);
            },
            function(callback) {
                debugLog("Disconnecting client");
                client.disconnect(callback);
            }
        ],function(err) {

            debugLog("finally");
            server.connected_client_count.should.equal(0);
            debugLog(" error : ", err);
            done();
        });

    });

    it("client shall be able to reconnect if first connection failed",function(done){

        server.connected_client_count.should.equal(0);

        client.protocolVersion = 1;

        var unused_port = 78909;
        var bad_endpointUrl = "opc.tcp://localhost:"+unused_port;

        async.series([
            function(callback) {
                client.connect(bad_endpointUrl,function(err){
                    err.message.should.equal("connect ECONNREFUSED");
                    callback();
                });
            },
            function(callback) {
                client.connect(endpointUrl,function(err){
                    assert( err === null);
                    callback(err);
                });
            },
            function(callback) {
                client.disconnect(callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);

    });

    it("client shall be able to connect & disconnect multiple times",function(done){

        server.connected_client_count.should.equal(0);

        async.series([

            function(callback) { client.connect(endpointUrl,callback);  },
            function(callback) { client.disconnect(callback);           },


            function(callback) { client.connect(endpointUrl,callback);  },
            function(callback) { client.disconnect(callback);           },

            function(callback) { client.connect(endpointUrl,callback);  },
            function(callback) { client.disconnect(callback);           },

            function(callback) {
                server.connected_client_count.should.equal(0);
                callback();
            }
        ],done);

    });

    it("client shall raise an error when trying to create a session on an invalid endpoint",function(done){

        async.series([
            function(callback) { client.connect(endpointUrl+"/somecrap",callback);       },

            function(callback) {
                client.createSession(function(err,session){

                    assert(err);
                    assert(!session);
                    callback(err ? null: new Error("Expecting a failure"));
                });
            },

            function(callback) { client.disconnect(callback);                }

        ],done);

    });

    it(" calling connect on the client twice shall return a error the second time",function(done){
        server.connected_client_count.should.equal(0);

        client.protocolVersion = 1;

        async.series([
            function(callback) {
                client.connect(endpointUrl,callback);
            },
            function(callback) {


                client.connect(endpointUrl,function(err) {

                    err.should.be.instanceOf(Error);

                    callback();
                });
            },
            function(callback) {
                client.disconnect(callback);
            },
            function(callback) {
                server.shutdown(callback);
            }
        ],done);
    });


    describe("Browse-Read-Write Services",function() {

        var g_session = null;

        beforeEach(function(done){
            client.connect(endpointUrl,function(err){
                if (err) { done(err);}
                else {
                    client.createSession(function(err,session){
                        g_session = session;
                        done(err);
                    });
                }
            });

        });

        afterEach(function(done){
            client.disconnect(done);
        });

        it("should browse RootFolder",function(done){

            g_session.browse("RootFolder",function(err,browseResults,diagnosticInfos){
                if (!err) {
                    browseResults.length.should.equal(1);
                    browseResults[0]._schema.name.should.equal("BrowseResult");
                }
                done(err);
            });

        });

        it("should read a Variable",function(done){

            g_session.readVariableValue("RootFolder",function(err,dataValues,diagnosticInfos){
                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                }
                done(err);
            });
        });

        it("should readAllAttributes",function(done){
            var readResult = g_session.readAllAttributes("RootFolder",function(err,nodesToRead,dataValues,diagnosticInfos){
                nodesToRead.length.should.equal(dataValues.length);
                done(err);
            });
        });

        it("should return a appropriate status code if nodeid to read doesn't exists",function(done){

            g_session.readVariableValue("ns=1;s=this_node_id_does_not_exist",function(err,dataValues,diagnosticInfos){
                dataValues[0].statusCode.should.eql(StatusCodes.Bad_NodeIdUnknown);
                done();

            });
        });

        it("should read the TemperatureTarget value", function(done) {

            g_session.readVariableValue("ns=1;s=TemperatureTarget",function(err,dataValues,diagnosticInfos){
                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                }

                done(err);

            });
        });

        it("should write the TemperatureTarget value", function(done) {

            var Variant = require("../lib/variant").Variant;
            var DataType = require("../lib/variant").DataType;
            // write a single value
            g_session.writeSingleNode(
                "ns=1;s=TemperatureTarget",
                {dataType: DataType.Double, value: 37.5 },
                function(err,statusCode,diagnosticInfo){
                    if (!err) {
                        statusCode.should.eql(StatusCodes.Good);
                    }
                    done(err);
                });
        });


    });
});




describe("Testing ChannelSecurityToken livetime",function(){


    var server , client;
    var endpointUrl ;
    beforeEach(function(done){

        server = new OPCUAServer();

        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        client = new OPCUAClient({
            defaultSecureTokenLiveTime: 100  // very short livetime !
        });
        server.start(function() {
            done();
        });


    });

    afterEach(function(done){

        client.disconnect(function(){
            server.shutdown(function() {
                done();
            });

        })

    });
    it("A secureschannel should raise a event to notify its client that its token is at 75% of its livetime",function(done){

        client.connect(endpointUrl,function(err){should(err).eql(null); });
        client._secureChannel.once("livetime_75",function(){
            debugLog(" received livetime_75");
            done();
        });
    });

    it("A secureschannel should raise a event to notify its client that a token about to expired has been renewed",function(done){

        client.connect(endpointUrl,function(err){should(err).eql(null); });
        client._secureChannel.on("security_token_renewed",function(){
            debugLog(" received security_token_renewed");
            done();
        });
    });

    it("A client should periodically renew the expiring security token",function(done){

        client.connect(endpointUrl,function(err){should(err).eql(null); });

        var security_token_renewed_counter = 0;
        client._secureChannel.on("security_token_renewed",function(){
            debugLog(" received security_token_renewed");
            security_token_renewed_counter+=1;
        });
        setTimeout(function(){
            security_token_renewed_counter.should.be.greaterThan(3);
            done();
        },600);
    });


});


var factories = require("../lib/factories");
// a fake request type that is supposed to be correcly decoded on server side
// but that is not supported by the server engine
var ServerSideUnimplementedRequest_Schema = {
    name: "AggregateConfiguration",
    fields: [
        { name: "requestHeader" ,              fieldType:"RequestHeader" }
    ]
};
var ServerSideUnimplementedRequest = factories.registerObject(ServerSideUnimplementedRequest_Schema);

describe("testing Server resiliance to unsupported request",function(){



    var server , client;
    var endpointUrl,g_session ;
    beforeEach(function(done){

        server = new OPCUAServer();
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        client = new OPCUAClient();

        server.start(function() {
            client.connect(endpointUrl,function(err){
                client.createSession(function(err,session){
                    g_session = session;
                    done();
                });
            });
        });
    });

    afterEach(function(done){
        client.disconnect(function(){
            server.shutdown(function() {
                done();
            });
        });

    });


    it("server should return a ServiceFault if receiving a unsupported MessageType",function(done){

        var s = require("../lib/structures");
        var bad_request = new ServerSideUnimplementedRequest(); // intentionnaly send a bad request

        g_session.performMessageTransaction(bad_request,function(err,response){
            assert(err instanceof Error);
            if(err) {
                done(null);
            } else {
                // console.log(JSON.stringify(response.results,null," ").yellow.bold);
                done(null);
            }
        });
    });



});