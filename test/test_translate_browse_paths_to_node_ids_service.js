var translate_service = require("../lib/translate_browse_paths_to_node_ids_service");
var StatusCodes = require("../lib/opcua_status_code").StatusCodes;
var ec = require("../lib/encode_decode");

describe("TranslateBrowsePathsToNodeIds service",function(){
    var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;

    it("should encode and decode a TranslateBrowsePathsToNodeIdsRequest",function(){

        var request = new translate_service.TranslateBrowsePathsToNodeIdsRequest({
            browsePath: [
                // BrowsePath
                {
                    startingNode : ec.makeNodeId(12),
                    relativePath: { // RelativePath
                        elements: [
                            // RelativePathElement
                            {
                                referenceTypeId: ec.makeExpandedNodeId(123),
                                isInverse: false,
                                includeSubtypes: true,
                                targetName: {
                                    // Qualified Name
                                    namespaceIndex: 1,
                                    name: "ObjectsFolder"
                                }
                            }
                        ]
                    }
                }
            ]
        });

        encode_decode_round_trip_test(request);
    });
    it("should encode and decode a TranslateBrowsePathsToNodeIdsResponse",function(){

        var response = new translate_service.TranslateBrowsePathsToNodeIdsResponse({
            results: [
                //BrowsePathResult
                new translate_service.BrowsePathResult({
                    statusCode: StatusCodes.Good,
                    targets: [
                        // BrowsePathTarget
                        {
                            targetId : ec.makeNodeId(12),
                            remainingPathIndex: 1
                        },
                        {
                            targetId : ec.makeNodeId(12),
                            remainingPathIndex: 200
                        }
                    ]

                })
            ]
        });

        encode_decode_round_trip_test(response);
    });

});




var _ = require("underscore");
var OPCUAServer = require("../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../lib/opcua-client").OPCUAClient;
var should = require("should");
var debugLog  = require("../lib/utils").make_debugLog(__filename);

function build_client_server_session(done){
    var server , client;
    var endpointUrl ;

    server = new OPCUAServer();
    // we will connect to first server end point
    endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
    debugLog("endpointUrl",endpointUrl);
    opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

    client = new OPCUAClient();

    function start(done) {
        server.start(function() {
            setImmediate(function() {
                client.connect(endpointUrl,function(err){
                    client.createSession(function(err,session){
                        client_server.g_session = session;
                        done();
                    });
                });
            });
        });
    }

    function shutdown(done){
        client.disconnect(function(){
            server.shutdown(function() {
                done();
            });
        });
    }

    var client_server = {
        g_session: null,
        shutdown:shutdown
    };
    start(done);
    return client_server;
};

describe("testing Client Server dealing with translate browse path",function(){
    var client_server;

    before(function(done){
        client_server = build_client_server_session(done);
    });

    after(function(done){
        client_server.shutdown(done);
    });

    it("server should translate a single browse path to a node id",function(done){
        var s = require("../lib/structures");

        var browsePath = new translate_service.BrowsePath({
            startingNode : ec.makeNodeId(12),
            relativePath: { // RelativePath
                elements: [
                    // RelativePathElement
                    {
                        referenceTypeId: ec.makeExpandedNodeId(123),
                        isInverse: false,
                        includeSubtypes: true,
                        targetName: {
                            // Qualified Name
                            namespaceIndex: 1,
                            name: "ObjectsFolder"
                        }
                    }
                ]
            }
        });
        client_server.g_session.translateBrowsePath(browsePath,function(err,browsePathResult){
            if (!err) {
                browsePathResult._schema.name.should.equal("BrowsePathResult");
                browsePathResult.statusCode;
                browsePathResult.targets;
            } else {
                throw err;
            }
            done();

        });

    });
});
