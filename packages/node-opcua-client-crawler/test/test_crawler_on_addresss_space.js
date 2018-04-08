var should = require("should");
var NodeCrawler = require("..").NodeCrawler;

var PseudoSession = require("node-opcua-address-space").PseudoSession;
var get_mini_address_space = require("node-opcua-address-space/test_helpers/get_mini_address_space").get_mini_address_space;

var ObjectIds = require("node-opcua-constants").ObjectIds;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;

describe("NodeCrawler",function(){

    var addressSpace = null;


    before(function (done) {
        get_mini_address_space(function (err, data) {
            addressSpace = data;
            done(err);
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });
    it("should crawl on a PseudoSession",function(done) {

        var session = new PseudoSession(addressSpace);

        var crawler  = new NodeCrawler(session);

        var results = [];
        var data = {
            onBrowse: function( crawler,cacheNode) {
                // console.log(cacheNode.browseName.toString());

                results.push(cacheNode.browseName.toString());

                NodeCrawler.follow(crawler,cacheNode,this);
            }
        };
        var nodeId = makeNodeId(ObjectIds.Server_ServerCapabilities); // server
        crawler.crawl(nodeId,data,function(err){
            //console.log(results.join(" "));
            results.join(" ").should.eql(
                "ServerCapabilities OperationLimits LocaleIdArray OperationLimitsType " +
                "MaxNodesPerRead MaxNodesPerHistoryReadData MaxNodesPerHistoryReadEvents " +
                "MaxNodesPerWrite MaxNodesPerHistoryUpdateData MaxNodesPerHistoryUpdateEvents " +
                "MaxNodesPerMethodCall MaxNodesPerBrowse MaxNodesPerRegisterNodes " +
                "MaxNodesPerTranslateBrowsePathsToNodeIds MaxNodesPerNodeManagement MaxMonitoredItemsPerCall " +
                "PropertyType MaxNodesPerRead MaxNodesPerHistoryReadData MaxNodesPerHistoryReadEvents " +
                "MaxNodesPerWrite MaxNodesPerHistoryUpdateData MaxNodesPerHistoryUpdateEvents MaxNodesPerMethodCall " +
                "MaxNodesPerBrowse MaxNodesPerRegisterNodes MaxNodesPerTranslateBrowsePathsToNodeIds " +
                "MaxNodesPerNodeManagement MaxMonitoredItemsPerCall " +
                "Optional HasModellingRule ModellingRuleType NamingRule NamingRule Mandatory NamingRule");
            done(err);
        });

    });
});
