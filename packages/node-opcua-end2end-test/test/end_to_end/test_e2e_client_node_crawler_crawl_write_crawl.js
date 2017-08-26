"use strict";


var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");
var DataType    = opcua.DataType;
var OPCUAClient = opcua.OPCUAClient;
var NodeCrawler = opcua.NodeCrawler;

var debugLog  = require("node-opcua-debug").make_debugLog(__filename);

var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


var address_space_for_conformance_testing  = require("node-opcua-address-space-for-conformance-testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

var describe = require("node-opcua-test-helpers/src/resource_leak_detector").describeWithLeakDetector;

describe("NodeCrawler after write",function(){

    var namespaceIndex = 411;
    var port = 2555;

    // this test could be particularly slow on RapsberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    this.timeout((process.arch === 'arm') ? 800000 : 200000);

    var server , client,temperatureVariableId,endpointUrl ;

    before(function(done){
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        //port+=1;
        server = build_server_with_temperature_device({ port:port},function(err) {

            build_address_space_for_conformance_testing(server.engine.addressSpace, {mass_variables: false});

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done){
        client = new OPCUAClient({
            requestedSessionTimeout: 60*1000*4 // 4 minutes
        });
        done();
    });

    afterEach(function(done){
        client = null;
        done();
    });

    after(function(done){
        server.shutdown(done);
    });


    it("should crawl, write to node, and crawl again", function(done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, session_done) {

            async.series([
                function(inner_done) {
                    console.log('Starting first');
                    var crawler = new NodeCrawler(session);

                    var nodeId = "RootFolder";

                    crawler.read(nodeId, function (err, obj) {
                        console.log('first', err);

                        if (!err) {
                            console.log('read success');
                            obj.browseName.toString().should.equal("Root");
                            obj.organizes.length.should.equal(3);
                            obj.organizes[0].browseName.toString().should.eql("Objects");
                            obj.organizes[1].browseName.toString().should.eql("Types");
                            obj.organizes[2].browseName.toString().should.eql("Views");
                            obj.typeDefinition.should.eql("FolderType");
                        }
                        inner_done(err);
                    });
                },

                function(inner_done) {
                    console.log('starting second');

                    var nodeId = opcua.coerceNodeId(2294);
                    console.log(nodeId);

                    var nodeToWrite =
                        {
                            dataType: DataType.Boolean,
                            value: true
                        };

                    session.writeSingleNode(nodeId, nodeToWrite,function(err, results){

                        console.log('res', results);

                        if (err) {
                            return inner_done(err);
                        }

                        results.should.eql(opcua.StatusCodes.Good);


                        inner_done();
                    });
                },

                function(inner_done) {
                    console.log('Starting third');
                    var crawler = new NodeCrawler(session);

                    var nodeId = "RootFolder";

                    crawler.read(nodeId, function (err, obj) {
                        console.log('second', err);
                        if (!err) {
                            console.log('read success');
                            obj.browseName.toString().should.equal("Root");
                            obj.organizes.length.should.equal(3);
                            obj.organizes[0].browseName.toString().should.eql("Objects");
                            obj.organizes[1].browseName.toString().should.eql("Types");
                            obj.organizes[2].browseName.toString().should.eql("Views");
                            obj.typeDefinition.should.eql("FolderType");
                        }
                        inner_done(err);
                    });
                }
            ], session_done);

        }, done);
    });

});
