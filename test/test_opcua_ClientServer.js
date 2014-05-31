var OPCUAServer = require("../lib/server/opcua_server").OPCUAServer;
var OPCUAClient = require("../lib/client/opcua_client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../lib/nodeopcua");

var debugLog  = require("../lib/misc/utils").make_debugLog(__filename);
var StatusCodes = require("../lib/datamodel/opcua_status_code").StatusCodes;
var browse_service = require("../lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var Variant = require("../lib/datamodel/variant").Variant;
var DataType = require("../lib/datamodel/variant").DataType;

var _ = require("underscore");

var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("testing basic Client-Server communication",function() {

    var server , client,temperatureVariableId,endpointUrl ;

    before(function(done){
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
//xx        port+=1;
        server = build_server_with_temperature_device({ port:port},function() {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient();
        done();
    });

    afterEach(function(done){
       client = null;
       done();
    });

    after(function(done){
        server.shutdown(done);
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
            }
        ],function(err) {
            server.connected_client_count.should.equal(0);
            debugLog(" error : ", err);
            done();
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

        var unused_port = 8909;
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
                    assert(!err);
                    callback(err);
                });
            },
            function(callback) {
                client.disconnect(callback);
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

    it("calling connect on the client twice shall return a error the second time",function(done){
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

            g_session.readAllAttributes("RootFolder",function(err,nodesToRead,dataValues,diagnosticInfos){
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

            g_session.readVariableValue(temperatureVariableId.nodeId,function(err,dataValues,diagnosticInfos){

                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                    dataValues[0].value._schema.name.should.equal("Variant");
                }

                done(err);

            });
        });

        it("should write the TemperatureTarget value", function(done) {

            var Variant = require("../lib/datamodel/variant").Variant;
            var DataType = require("../lib/datamodel/variant").DataType;
            // write a single value
            g_session.writeSingleNode(
                temperatureVariableId.nodeId,
                {dataType: DataType.Double, value: 37.5 },
                function(err,statusCode/*,diagnosticInfo*/){
                    if (!err) {
                         statusCode.should.eql(StatusCodes.Good);
                    }
                    done(err);
                });
        });

        describe("Accessing Server Object",function(){
            var makeNodeId = require("../lib/datamodel/nodeid").makeNodeId;
            var ReferenceTypeIds = require("../lib/opcua_node_ids").ReferenceTypeIds;
            var VariableIds = require("../lib/opcua_node_ids").VariableIds;

            it("Server should expose a 'Server' object in the 'Objects' folder",function(done){

                var Organizes = makeNodeId(ReferenceTypeIds.Organizes); // "ns=0;i=35";
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

            it("Server should expose 'Server_NamespaceArray' variable ",function(done){
                var DataValue = require("../lib/datamodel/datavalue").DataValue;
                var DataType = require("../lib/datamodel/variant").DataType;
                var VariantArrayType = require("../lib/datamodel/variant").VariantArrayType;
                var StatusCodes = require("../lib/datamodel/opcua_status_code").StatusCodes;
                var server_NamespaceArray_Id =  makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
                g_session.readVariableValue(server_NamespaceArray_Id,function(err,results,diagnosticsInfo){
                    var dataValue = results[0];
                    dataValue.should.be.instanceOf(DataValue);
                    dataValue.statusCode.should.eql(StatusCodes.Good);
                    dataValue.value.dataType.should.eql(DataType.String);
                    dataValue.value.arrayType.should.eql(VariantArrayType.Array);

                    // first namespace must be standard OPC namespace
                    dataValue.value.value[0].should.eql("http://opcfoundation.org/UA/");

                    done();
                });

            });
        });
    });

});



