require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;

var port = 2000;

var empty_nodeset_filename = require("path").join(__dirname, "../fixtures/fixture_empty_nodeset2.xml");
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;


describe("testing server with low maxNodesPerRead and maxNodesPerBrowse", function () {


    this.timeout(10000);

    var server = new OPCUAServer({
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
                maxNodesPerRegisterNodes: 0,
                maxNodesPerNodeManagement: 0,
                maxMonitoredItemsPerCall: 120,
                maxNodesPerHistoryReadData: 0,
                maxNodesPerHistoryReadEvents: 0,
                maxNodesPerHistoryUpdateData: 0,
                maxNodesPerHistoryUpdateEvents: 0
            }
        }
    });

    var client = new OPCUAClient();

    var endpointUrl;
    before(function (done) {
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
                OPCUAServer.getRunningServerCount().should.eql(0);
                callback();
            }

        ], done);
    });

    it("should be possible to customize serverCapabilities.operationLimits at construction time", function () {
        server.engine.serverCapabilities.operationLimits.maxNodesPerRead.should.eql(10);
        server.engine.serverCapabilities.operationLimits.maxMonitoredItemsPerCall.should.eql(120);

    });

    it("server should provide OperationLimits_MaxNodesPerRead node ", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            server.engine.serverCapabilities.operationLimits.maxNodesPerRead.should.eql(10);

            var n1 = opcua.VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead;
            var n2 = opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount;

            var nodeId1 = opcua.makeNodeId(n1);
            var nodesToRead = [
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
            ];
            session.read(nodesToRead, function (err, a, results) {
                // console.log(results);
                results[0].value.value.should.eql(server.engine.serverCapabilities.operationLimits.maxNodesPerRead);
                done(err);
            });

        }, done);


    });

    it("server should only threat MaxNodesPerRead in read operation ", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {

            server.engine.serverCapabilities.operationLimits.maxNodesPerRead.should.eql(10);

            var n1 = opcua.VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead;
            var n2 = opcua.VariableIds.Server_ServerDiagnostics_ServerDiagnosticsSummary_CurrentSessionCount;

            var nodeId1 = opcua.makeNodeId(n1);
            var nodeId2 = opcua.makeNodeId(n2);
            console.log(nodeId1.toString());
            var nodesToRead = [
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId2, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId2, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId2, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId2, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId2, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId1, attributeId: opcua.AttributeIds.Value},
                {nodeId: nodeId2, attributeId: opcua.AttributeIds.Value}
            ];
            nodesToRead.length.should.be.greaterThan(server.engine.serverCapabilities.operationLimits.maxNodesPerRead);

            session.read(nodesToRead, function (err, a, results) {
                if (!err) {
                    results.length.should.eql(10);
                }
                done(err);
            });

        }, done);


    });

    it("server should only threat MaxNodesPerBrowse in browse operation ", function (done) {

        server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse.should.equal(2);

        perform_operation_on_client_session(client, endpointUrl, function (session, done) {
            var browseRequest = [];

            var bad_referenceid_node = "ns=3;i=3500";
            var browseDesc = {
                nodeId: "ObjectsFolder",
                referenceTypeId: bad_referenceid_node,
                browseDirection: opcua.browse_service.BrowseDirection.Forward
            };
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);
            browseRequest.push(browseDesc);

            browseRequest.length.should.be.greaterThan(server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse);

            session.browse(browseRequest, function (err, results) {
                if (!err) {
                    results.length.should.eql(server.engine.serverCapabilities.operationLimits.maxNodesPerBrowse);
                }
                done(err);
            });
        }, done);

    });

    it("crawler shall work even if server has a low limit the number of node in Read and Browse request", function (done) {

        var NodeCrawler = opcua.NodeCrawler;
        var redirectToFile = require("lib/misc/utils").redirectToFile;

        //xx redirectToFile("crawler_display_tree1.log",function(done){

        var treeify = require('treeify');

        perform_operation_on_client_session(client, endpointUrl, function (the_session, callback) {

            var crawler = new NodeCrawler(the_session);

            crawler.on("browsed", function (element) {
            });

            var nodeId = "ObjectsFolder";
            crawler.read(nodeId, function (err, obj) {
                if (!err) {
                }
                callback(err);
            });

        }, done);
        //xx },done);

    });

    it("should crawl a server cyclic-node ", function (done) {


        server.subFolder1 = server.engine.addFolder("RootFolder", "SubFolder1");
        server.subFolder2 = server.engine.addFolder("SubFolder1", "SubFolder2");
        //xx server.engine.addComponentInFolder(server.subFolder2, server.subFolder1);
        done();
    });
});


