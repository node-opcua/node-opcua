import { should } from "should";
import * as sinon from "sinon";

import {
    AddressSpace,
    getMiniAddressSpace,
    PseudoSession
} from "node-opcua-address-space";

import {
    ObjectIds
} from "node-opcua-constants";
import { BrowseDirection } from "node-opcua-data-model";
import {
    makeNodeId,
    NodeId
} from "node-opcua-nodeid";

import {
    CacheNode,
    NodeCrawler,
    UserData
} from "..";

describe("NodeCrawler", () => {

    let addressSpace: AddressSpace;
    let groupNodeId: NodeId;
    before(async () => {

        addressSpace = await getMiniAddressSpace();

        const group = addressSpace.getOwnNamespace().addObject({
            browseName: "Group",
            organizedBy: addressSpace.rootFolder.objects
        });

        for (let i = 0; i < 10; i++) {
            addressSpace.getOwnNamespace().addObject({
                browseName: "Object" + i,
                organizedBy: group
            });
        }
        groupNodeId = group.nodeId;
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    function followForward(crawler: NodeCrawler, cacheNode: CacheNode, userData: UserData) {

        NodeCrawler.follow(crawler, cacheNode, userData, "Organizes", BrowseDirection.Forward);
        NodeCrawler.follow(crawler, cacheNode, userData, "HasComponent", BrowseDirection.Forward);
        NodeCrawler.follow(crawler, cacheNode, userData, "HasProperty", BrowseDirection.Forward);

        // for (const reference  of cacheNode.references) {
        //    if (reference.isForward && reference.referenceTypeId.toString() === "i=35") {
        //        console.log( cacheNode.browseName, reference.isForward, reference.nodeId.toString());
        //        crawler.followReference(cacheNode, reference, userData);
        //    }
        // }
    }

    it("should crawl on a PseudoSession", async () => {

        const session = new PseudoSession(addressSpace);

        const crawler = new NodeCrawler(session);

        const results: string[] = [];

        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawler, cacheNode: CacheNode) {
                results.push(cacheNode.browseName.toString());
                followForward(crawler1, cacheNode, this);
            }
        };
        const nodeId = makeNodeId(ObjectIds.Server_ServerCapabilities); // server

        await crawler.crawl(nodeId, data);

        results.sort().join(" ").should.eql(
          "HasComponent HasProperty " +
          "LocaleIdArray " +
          "MaxMonitoredItemsPerCall "+
          "MaxNodesPerBrowse " +
          "MaxNodesPerHistoryReadData " +
          "MaxNodesPerHistoryReadEvents " +
          "MaxNodesPerHistoryUpdateData " +
          "MaxNodesPerHistoryUpdateEvents " +
          "MaxNodesPerMethodCall " +
          "MaxNodesPerNodeManagement " +
          "MaxNodesPerRead " +
          "MaxNodesPerRegisterNodes " +
          "MaxNodesPerTranslateBrowsePathsToNodeIds " +
          "MaxNodesPerWrite " + 
          "OperationLimits " +
          "ServerCapabilities");

    });

    it("should crawl a very large number of nodes", async () => {

        const session = new PseudoSession(addressSpace);

        (session as any).browse = sinon.spy(session, "browse");
        (session as any).browseNext = sinon.spy(session, "browseNext");
        (session as any).read = sinon.spy(session, "read");

        const crawler = new NodeCrawler(session);
        crawler.maxNodesPerBrowse = 5;

        const results: string[] = [];

        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawler, cacheNode: CacheNode) {
                results.push(cacheNode.browseName.toString());
                followForward(crawler1, cacheNode, this);
                // NodeCrawler.follow(crawler1, cacheNode, this, "Organizes");
            }
        };

        await crawler.crawl(groupNodeId, data);

        results.sort().join(" ").should.eql(
          "1:Group 1:Object0 1:Object1 " + 
          "1:Object2 1:Object3 1:Object4 "+ 
          "1:Object5 1:Object6 1:Object7 "+ 
          "1:Object8 1:Object9 Organizes");

        console.log("browseCounter = ",     crawler.browseCounter);
        console.log("browseNextCounter = ", crawler.browseNextCounter);
        console.log("readCounter = ",       crawler.readCounter);
        // crawler.browseNextCounter.should.be.greaterThan(0);
    });
});
