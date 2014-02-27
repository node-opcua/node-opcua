var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../lib/nodeopcua");

var debugLog  = require("../lib/utils").make_debugLog(__filename);
var StatusCodes = require("../lib/opcua_status_code").StatusCodes;
var browse_service = require("../lib/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var _ = require("underscore");

var port = 2000;

describe("testing basic Client-Server communication",function() {

    var server , client;
    var endpointUrl ;
    beforeEach(function(done){

        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could provoque an error
        port+=1;
        server = new OPCUAServer({ port:port});
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);
        client = new OPCUAClient();

        server.start(function() {
            done();
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

        it("browse should return Bad_ReferenceTypeIdInvalid if referenceTypeId is invalid",function(done){

            var bad_referenceid_node = "ns=3;i=3500";
            var browseDesc = {
                nodeId: "ObjectsFolder",
                referenceTypeId: bad_referenceid_node,
                browseDirection: BrowseDirection.Forward
            };
            g_session.browse(browseDesc,function(err,browseResults,diagnosticInfos){
                browseResults.length.should.equal(1);
                browseResults[0]._schema.name.should.equal("BrowseResult");
                browseResults[0].statusCode.should.eql(StatusCodes.Bad_ReferenceTypeIdInvalid);
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

        xit("should read the TemperatureTarget value", function(done) {

            g_session.readVariableValue("ns=1;s=TemperatureTarget",function(err,dataValues,diagnosticInfos){
                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                }

                done(err);

            });
        });

        xit("should write the TemperatureTarget value", function(done) {

            var Variant = require("../lib/variant").Variant;
            var DataType = require("../lib/variant").DataType;
            // write a single value
            g_session.writeSingleNode(
                "ns=1;s=TemperatureTarget",
                {dataType: DataType.Double, value: 37.5 },
                function(err,statusCode,diagnosticInfo){
                    if (!err) {
//xx                   statusCode.should.eql(StatusCodes.Good);
                    }
                    done(err);
                });
        });

        describe("Accessing Server Object",function(){

            it("Server should expose a 'Server' object in the 'Objects' folder",function(done){

                var Organizes = "ns=0;i=35";
                var browseDesc = {
                    nodeId: "ObjectsFolder",
                    referenceTypeId: Organizes,
                    browseDirection: BrowseDirection.Forward
                };

                g_session.browse(browseDesc,function(err,browseResults/*,diagnosticInfos*/){
                    if (!err) {
                        browseResults.length.should.equal(1);
                        browseResults[0]._schema.name.should.equal("BrowseResult");

                        console.log(util.inspect(browseResults[0].references,{colors:true,depth:10}));

                        var foundNode = _.filter(browseResults[0].references,function(result){ return result.browseName.name === "Server"});
                        foundNode.length.should.equal(1);
                        foundNode[0].browseName.name.should.equal("Server");
                        foundNode[0].nodeId.toString().should.equal("ns=0;i=2253");
                    }
                    done(err);
                });
            });
        });
    });

});



