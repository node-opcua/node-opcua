

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

var _ = require("underscore");


var factories = require("../lib/misc/factories");

// a fake request type that is supposed to be correctly decoded on server side
// but that is not supported by the server engine
var ServerSideUnimplementedRequest_Schema = {
    name: "Annotation",
    fields: [
        { name: "requestHeader" ,              fieldType:"RequestHeader" }
    ]
};
var ServerSideUnimplementedRequest = factories.registerObject(ServerSideUnimplementedRequest_Schema);

describe("testing Server resilience to unsupported request",function(){
    var server , client;
    var endpointUrl,g_session ;

    before(function(done){

        server = new OPCUAServer();
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        debugLog("endpointUrl",endpointUrl);
        opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

        client = new OPCUAClient();

        server.start(function() {
            setImmediate(function() {
                client.connect(endpointUrl,function(err){
                    client.createSession(function(err,session){
                        g_session = session;
                        done();
                    });
                });
            });
        });
    });

    after(function(done){
        client.disconnect(function(){
            server.shutdown(function() {
                done();
            });
        });

    });

    it("server should return a ServiceFault if receiving a unsupported MessageType",function(done){
        var s = require("../lib/datamodel/structures");
        var bad_request = new ServerSideUnimplementedRequest(); // intentionally send a bad request

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