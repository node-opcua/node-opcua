"use strict";

const should = require("should");
const async = require("async");

const { OPCUAClient, DataType, NodeCrawler, StatusCodes, AttributeIds } = require("node-opcua");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const { build_address_space_for_conformance_testing } = require("node-opcua-address-space-for-conformance-testing");

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("NodeCrawlerBase after write", function () {
    const port = 2012;

    // this test could be particularly slow on RaspberryPi or BeagleBoneBlack
    // so we set a big enough timeout
    this.timeout(process.arch === "arm" ? 800000 : 200000);

    let server, client, temperatureVariableId, endpointUrl;

    before(async () => {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        //port+=1;
        server = await build_server_with_temperature_device({ port });

        build_address_space_for_conformance_testing(server.engine.addressSpace, { mass_variables: false });

        endpointUrl = server.getEndpointUrl();
        temperatureVariableId = server.temperatureVariableId;
    });

    beforeEach(async () => {
        client = OPCUAClient.create({
            requestedSessionTimeout: 60 * 1000 * 4 // 4 minutes
        });
        client.on("backoff", (count, delay) => {
            console.log("Backoff ", endpointUrl);
        });
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(async () => {
        await server.shutdown();
    });

    it("should crawl, write to node, and crawl again", function (done) {
        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, session_done) {
                async.series(
                    [
                        function (inner_done) {
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
                                crawler.dispose();
                                inner_done(err);
                            });
                        },

                        function (inner_done) {
                            const nodeId = "ns=2;s=Static_Scalar_Boolean"; // coerceNodeId(2294);

                            const variantValue = {
                                dataType: DataType.Boolean,
                                value: true
                            };

                            const nodeToWrite = {
                                nodeId,
                                attributeId: AttributeIds.Value,
                                value: {
                                    value: variantValue
                                }
                            };
                            session.write(nodeToWrite, (err, results) => {
                                if (err) {
                                    return inner_done(err);
                                }

                                results.should.eql(StatusCodes.Good);

                                inner_done();
                            });
                        },

                        function (inner_done) {
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
                                crawler.dispose();
                                inner_done(err);
                            });
                        }
                    ],
                    session_done
                );
            },
            done
        );
    });
});
