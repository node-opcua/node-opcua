const should = require("should");
const NodeCrawler = require("..").NodeCrawler;

const PseudoSession = require("node-opcua-address-space").PseudoSession;
const getMiniAddressSpace = require("node-opcua-address-space").getMiniAddressSpace;

const ObjectIds = require("node-opcua-constants").ObjectIds;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;

describe("NodeCrawler",function(){

    let addressSpace = null;

    before(function (done) {
        getMiniAddressSpace(function (err, data) {
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
                //xx console.log(cacheNode.browseName.toString());
                results.push(cacheNode.browseName.toString());
                NodeCrawler.follow(crawler,cacheNode,this);
            }
        };
        const nodeId = makeNodeId(ObjectIds.Server_ServerCapabilities); // server
        crawler.crawl(nodeId,data,function(err){
            //console.log(results.join(" "));
            results.sort().join(" ").should.eql(
              "HasComponent HasModellingRule HasOrderedComponent HasProperty" +
              " HasSubtype HasTypeDefinition " +
              "LocaleIdArray Mandatory MaxMonitoredItemsPerCall " +
              "MaxMonitoredItemsPerCall MaxNodesPerBrowse MaxNodesPerBrowse " +
              "MaxNodesPerHistoryReadData MaxNodesPerHistoryReadData " +
              "MaxNodesPerHistoryReadEvents MaxNodesPerHistoryReadEvents " +
              "MaxNodesPerHistoryUpdateData MaxNodesPerHistoryUpdateData " +
              "MaxNodesPerHistoryUpdateEvents MaxNodesPerHistoryUpdateEvents " +
              "MaxNodesPerMethodCall MaxNodesPerMethodCall " +
              "MaxNodesPerNodeManagement MaxNodesPerNodeManagement " +
              "MaxNodesPerRead MaxNodesPerRead MaxNodesPerRegisterNodes " +
              "MaxNodesPerRegisterNodes " +
              "MaxNodesPerTranslateBrowsePathsToNodeIds " +
              "MaxNodesPerTranslateBrowsePathsToNodeIds MaxNodesPerWrite " +
              "MaxNodesPerWrite ModellingRuleType NamingRule NamingRule " +
              "NamingRule OperationLimits OperationLimitsType Optional " +
              "PropertyType ServerCapabilities");
            done(err);
        });

    });
});
