"use strict";


const should = require("should");
const async = require("async");
const _ = require("underscore");

const opcua = require("node-opcua");
const DataType    = opcua.DataType;
const OPCUAClient = opcua.OPCUAClient;
const NodeCrawler = opcua.NodeCrawler;

const debugLog  = require("node-opcua-debug").make_debugLog(__filename);

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;
const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


const address_space_for_conformance_testing  = require("node-opcua-address-space-for-conformance-testing");
const build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("NodeCrawler after write",function(){

    const namespaceIndex = 411;
    const port = 2555;

    // this test could be particularly slow on RapsberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    this.timeout((process.arch === 'arm') ? 800000 : 200000);

    let server, client, temperatureVariableId, endpointUrl;

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
        client = OPCUAClient.create({
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
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    crawler.read(nodeId, function (err, obj) {

                        if (!err) {
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

                    const nodeId = "ns=2;s=Scalar_Static_Boolean";// opcua.coerceNodeId(2294);

                    const dataValue = {
                        dataType: DataType.Boolean,
                        value: true
                    };

                    session.writeSingleNode(nodeId, dataValue,function(err, results){


                        if (err) {
                            return inner_done(err);
                        }

                        results.should.eql(opcua.StatusCodes.Good);


                        inner_done();
                    });
                },

                function(inner_done) {
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    crawler.read(nodeId, function (err, obj) {
                        if (!err) {
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
