

const should = require("should");
const assert = require("node-opcua-assert").assert;
const async = require("async");
const _ = require("underscore");

const opcua = require("node-opcua");

const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;
const BrowseDirection = opcua.BrowseDirection;
const makeBrowsePath = opcua.makeBrowsePath;

assert(_.isFunction(makeBrowsePath));

const port = 2000;


const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing server with low maxNodesPerRead and maxNodesPerBrowse", function () {


    this.timeout(Math.max(this._timeout, 10000));

    let server;

    let client;


    let endpointUrl;
    before(function (done) {

        server = new OPCUAServer({
            port: port,

            // xx nodeset_filename: empty_nodeset_filename,

            maxAllowedSessionNumber: 1,

            serverCapabilities: {
                maxArrayLength: 0,
                maxStringLength: 0,
                maxBrowseContinuationPoints: 0,
                maxQueryContinuationPoints: 0,
                maxHistoryContinuationPoints: 0,
                operationLimits: {
                    maxNodesPerRead: 10,
                    maxNodesPerWrite: 10,
                    maxNodesPerMethodCall: 10,
                    maxNodesPerBrowse: 2,
                    maxNodesPerRegisterNodes: 3,
                    maxNodesPerNodeManagement: 4,
                    maxMonitoredItemsPerCall: 120,
                    maxNodesPerHistoryReadData: 5,
                    maxNodesPerHistoryReadEvents: 6,
                    maxNodesPerHistoryUpdateData: 7,
                    maxNodesPerHistoryUpdateEvents: 8,
                    maxNodesPerTranslateBrowsePathsToNodeIds: 9
                }
            }
        });
        client = OPCUAClient.create();
        server.start(function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            done();
        });

    });

    after(function (done) {

        async.series([
            function (callback) {
                client.disconnect(callback);
            },
            function (callback) {
                server.shutdown(callback);
            },
            function (callback) {
                OPCUAServer.registry.count().should.eql(0);
                callback();
            }

        ], done);
    });

    it("should be possible to customize serverCapabilities.operationLimits at construction time", function () {
        server.engine.serverCapabilities.operationLimits.maxNodesPerRead.should.eql(10);
        server.engine.serverCapabilities.operationLimits.maxNodesPerWrite.should.eql(10);
        server.engine.serverCapabilities.operationLimits.maxNodesPerMethodCall.should.eql(10);
        server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse.should.eql(2);

        server.engine.serverCapabilities.operationLimits.maxNodesPerRegisterNodes.should.eql(3);
        server.engine.serverCapabilities.operationLimits.maxNodesPerNodeManagement.should.eql(4);
        server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall.should.eql(120);
        server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadData.should.eql(5);
        server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryReadEvents.should.eql(6);
        server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryUpdateData.should.eql(7);
        server.engine.serverCapabilities.operationLimits.maxNodesPerHistoryUpdateEvents.should.eql(8);
        server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds.should.eql(9);


    });

    it("server should provide OperationLimits_MaxNodesPerRead node ", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            server.engine.serverCapabilities.operationLimits.maxNodesPerRead.should.eql(10);

            const n1 = opcua.VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead;
            const n2 = opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount;

            const nodeId1 = opcua.makeNodeId(n1);

            const nodeToRead = { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value };

            session.read(nodeToRead, function (err, dataValue) {
                // console.log(results);
                dataValue.value.value.should.eql(server.engine.serverCapabilities.operationLimits.maxNodesPerRead);
                done(err);
            });

        }, done);


    });

    it("server should return BadTooManyOperations when nodesToRead exceed MaxNodesPerRead in read operation ", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            server.engine.serverCapabilities.operationLimits.maxNodesPerRead.should.eql(10);

            const n1 = opcua.VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead;
            const n2 = opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount;

            const nodeId1 = opcua.makeNodeId(n1);
            const nodeId2 = opcua.makeNodeId(n2);
            console.log(nodeId1.toString());
            const nodesToRead = [
                { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId2, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId2, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId2, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId2, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId2, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId1, attributeId: opcua.AttributeIds.Value },
                { nodeId: nodeId2, attributeId: opcua.AttributeIds.Value }
            ];
            nodesToRead.length.should.be.greaterThan(server.engine.serverCapabilities.operationLimits.maxNodesPerRead);

            session.read(nodesToRead, function (err, dataValues) {
                should.exist(err);
                err.message.should.match(/BadTooManyOperations/);
                done();
            });

        }, done);


    });

    it("server should return BadTooManyOperations when browseRequest exceed MaxNodesPerBrowse in browse operation ", function (done) {

        server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse.should.equal(2);

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {
            const browseRequest = [];

            const bad_referenceid_node = "ns=3;i=3500";
            const browseDesc = {
                nodeId: "ObjectsFolder",
                referenceTypeId: bad_referenceid_node,
                browseDirection: BrowseDirection.Forward
            };
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);

            browseRequest.length.should.be.greaterThan(server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse);

            session.browse(browseRequest, function (err, browseResults) {
                should.exist(err);
                err.message.should.match(/BadTooManyOperations/);
                done();
            });
        }, done);

    });
    it("server should return BadTooManyOperations when translate exceed maxNodesPerTranslateBrowsePathsToNodeIds in translate operation ", function (done) {

        server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse.should.equal(2);

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            const translateBrowsePath = [
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),
                makeBrowsePath("RootFolder", "/Objects/Server"),

            ];

            server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds.should.be.greaterThan(1);
            translateBrowsePath.length.should.be.greaterThan(server.engine.serverCapabilities.operationLimits.maxNodesPerTranslateBrowsePathsToNodeIds);

            session.translateBrowsePath(translateBrowsePath, function (err, results) {
                should.exist(err);
                err.message.should.match(/BadTooManyOperations/);
                done();
            });
        }, done);

    });

    it("crawler shall work even if server has a low limit the number of node in Read and Browse request", function (done) {

        const NodeCrawler = opcua.NodeCrawler;
        const redirectToFile = require("node-opcua-debug").redirectToFile;

        //xx redirectToFile("crawler_display_tree1.log",function(done){

        const treeify = require('treeify');

        perform_operation_on_client_session(client, endpointUrl, function (the_session, callback) {

            const crawler = new NodeCrawler(the_session);

            crawler.on("browsed", function (element) {
            });

            const nodeId = "ObjectsFolder";
            crawler.read(nodeId, function (err, obj) {
                if (!err) { /**/
                }
                crawler.dispose();
                callback(err);

            });

        }, done);
        //xx },done);

    });

    xit("should crawl a server cyclic-node ", function (done) {

        const namespace = server.engine.addresSpaec.getOwnNamespace();
        // TODO
        server.subFolder1 = namespace.addFolder("ObjectsFolder", "SubFolder1");
        server.subFolder2 = namespace.addFolder(server.subFolder1, "SubFolder2");
        done();
    });
});


