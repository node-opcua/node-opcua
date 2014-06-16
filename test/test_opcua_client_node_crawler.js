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
var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;
// var perform_operation_on_subscription = require("./helpers/perform_operation_on_client_session").perform_operation_on_subscription;

var dumpReferences = require("../lib/address_space/basenode").dumpReferences;

describe("NodeCrawler",function(){

    var server , client,temperatureVariableId,endpointUrl ;

    var port = 2001;
    before(function(done){
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port+=1;
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


    function MyDumpReference(reference) {

        console.log(" referenceTypeId ", reference.referenceTypeId.toString());
        console.log(" isForward       ", reference.isForward.toString());
        console.log(" isForward       ", reference.nodeId.toString() +"  "+ reference.browseName.name);
        // displayName: [Object],
        // nodeClass: [Getter/Setter],
        // typeDefinition: [Object]
    }
    function MyDumpReferences(index,references) { references.forEach(MyDumpReference);}

    it("should crawl rootNode",function(done){

        perform_operation_on_client_session(client,endpointUrl,function(session,done){


            var NodeCrawler = require("../lib/client/node_crawler").NodeCrawler;

            var crawler = new NodeCrawler(session);

            crawler.browse("RootFolder",function(err,nodeElement){

                console.log(nodeElement);

                var objectIndex = {
                    findObject: function(nodeId){
                        return null;
                    }
                };

                MyDumpReferences(objectIndex,nodeElement.references);
                done(err);
            });

        },done);

    })
});
