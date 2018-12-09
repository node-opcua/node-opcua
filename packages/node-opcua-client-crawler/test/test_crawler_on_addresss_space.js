const should = require("should");
const NodeCrawler = require("..").NodeCrawler;

const PseudoSession = require("node-opcua-address-space").PseudoSession;
const get_mini_address_space = require("node-opcua-address-space/test_helpers/get_mini_address_space").get_mini_address_space;

const ObjectIds = require("node-opcua-constants").ObjectIds;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;

describe("NodeCrawler",function(){

    let addressSpace = null;


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

        const session = new PseudoSession(addressSpace);

        const crawler  = new NodeCrawler(session);

        const results = [];
        const data = {
            onBrowse: function( crawler,cacheNode) {
                // console.log(cacheNode.browseName.toString());

                results.push(cacheNode.browseName.toString());

                NodeCrawler.follow(crawler,cacheNode,this);
            }
        };
        const nodeId = makeNodeId(ObjectIds.Server_ServerCapabilities); // server
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
