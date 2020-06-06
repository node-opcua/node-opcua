import { should } from "should";
import * as sinon from "sinon";

import {
    AddressSpace,
    getMiniAddressSpace,
    PseudoSession,
    UAVariable,
} from "node-opcua-address-space";

import {
    ObjectIds, DataTypeIds
} from "node-opcua-constants";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import {
    makeNodeId,
    NodeId
} from "node-opcua-nodeid";

import { DataType } from "node-opcua-client";
import {
    CacheNode,
    NodeCrawler,
    UserData
} from "..";

describe("NodeCrawler", function (this: any) {

    this.timeout(200000);

    let addressSpace: AddressSpace;
    let groupNodeId: NodeId;
    let massVariablesNodeId: NodeId;
    before(async () => {

        addressSpace = await getMiniAddressSpace();

        addressSpace.isFrugal = true;

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

        const massVariables = addressSpace.getOwnNamespace().addObject({
            browseName: "MassVariables",
            organizedBy: addressSpace.rootFolder.objects
        });
        massVariablesNodeId = massVariables.nodeId;
        for (let i = 0; i < 10000; i++) {
            addressSpace.getOwnNamespace().addVariable({
                browseName: "Variable" + i,
                dataType: "Double",
                organizedBy: massVariables,
                value: { dataType: "Double", value: i },
            });
        }

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
            "MaxMonitoredItemsPerCall " +
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

        crawler.dispose();

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
            "1:Object2 1:Object3 1:Object4 " +
            "1:Object5 1:Object6 1:Object7 " +
            "1:Object8 1:Object9 Organizes");

        // tslint:disable: no-console
        console.log("browseCounter = ", crawler.browseCounter);
        console.log("browseNextCounter = ", crawler.browseNextCounter);
        console.log("readCounter = ", crawler.readCounter);
        // crawler.browseNextCounter.should.be.greaterThan(0);
        crawler.dispose();
    });

    it("issue #655: it should used provided MaxNodePerRead/MaxNodePerBrowse as a minimum value when set <> 0 and server provide limits", async () => {

        // Given a server that provides some limit for MaxNodesPerRead && MaxNodesPerBrowse
        const maxNodesPerReadVar = addressSpace.findNode("Server_ServerCapabilities_OperationLimits_MaxNodesPerRead")! as UAVariable;
        const maxNodesPerBrowseVar = addressSpace.findNode("Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse")! as UAVariable;

        maxNodesPerReadVar.setValueFromSource({ dataType: DataType.UInt32, value: 251 });
        maxNodesPerBrowseVar.setValueFromSource({ dataType: DataType.UInt32, value: 252 });
        maxNodesPerReadVar.readValue().value.value.should.eql(251);
        maxNodesPerBrowseVar.readValue().value.value.should.eql(252);

        const session = new PseudoSession(addressSpace);

        {
            // Given that NodeCrawler doesn't specify minimum value for  maxNodesPerRead/Browse
            const crawler = new NodeCrawler(session);
            crawler.maxNodesPerRead = 0;
            crawler.maxNodesPerBrowse = 0;
            await crawler.crawl(groupNodeId, { onBrowse: () => {/* empty */ } });

            // then NodeCrawler shall be set with value provided by server
            crawler.maxNodesPerRead.should.eql(251);
            crawler.maxNodesPerBrowse.should.eql(252);
            crawler.dispose();
        }

        {
            // Given that NodeCrawler does  specify minimum value for  maxNodesPerRead/Browse
            // which are below server provided limit
            const crawler = new NodeCrawler(session);
            crawler.maxNodesPerRead = 5;
            crawler.maxNodesPerBrowse = 10;
            await crawler.crawl(groupNodeId, { onBrowse: () => {/* empty */ } });
            // then NodeCrawler shall be set with value provided by itself
            crawler.maxNodesPerRead.should.eql(5);
            crawler.maxNodesPerBrowse.should.eql(10);
            crawler.dispose();
        }
        {
            // Given that NodeCrawler does  specify minimum value for  maxNodesPerRead/Browse
            // which are above server provided limit
            const crawler = new NodeCrawler(session);
            crawler.maxNodesPerRead = 501;
            crawler.maxNodesPerBrowse = 502;
            await crawler.crawl(groupNodeId, { onBrowse: () => {/* empty */ } });
            // then NodeCrawler shall be set with value provided by server
            crawler.maxNodesPerRead.should.eql(251);
            crawler.maxNodesPerBrowse.should.eql(252);
            crawler.dispose();
        }

    });
    it("issue #655: it should used provided MaxNodePerRead/MaxNodePerBrowse as a minimum value when set <> 0 and server do not provide limits", async () => {

        // Given a server that DOES NOT provide some limit for MaxNodesPerRead && MaxNodesPerBrowse
        const maxNodesPerReadVar = addressSpace.findNode("Server_ServerCapabilities_OperationLimits_MaxNodesPerRead")! as UAVariable;
        const maxNodesPerBrowseVar = addressSpace.findNode("Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse")! as UAVariable;

        maxNodesPerReadVar.setValueFromSource({ dataType: DataType.UInt32, value: 0 });
        maxNodesPerBrowseVar.setValueFromSource({ dataType: DataType.UInt32, value: 0 });

        maxNodesPerReadVar.readValue().value.value.should.eql(0);
        maxNodesPerBrowseVar.readValue().value.value.should.eql(0);

        const session = new PseudoSession(addressSpace);

        {
            // Given that NodeCrawler doesn't specify minimum value for  maxNodesPerRead/Browse
            const crawler = new NodeCrawler(session);
            crawler.maxNodesPerRead = 0;
            crawler.maxNodesPerBrowse = 0;
            // then NodeCrawler shall be set with default value provided by NodeCrawler
            await crawler.crawl(groupNodeId, { onBrowse: () => {/* empty */ } });
            crawler.maxNodesPerRead.should.eql(100);
            crawler.maxNodesPerBrowse.should.eql(100);
            crawler.dispose();
        }

        {
            const crawler = new NodeCrawler(session);
            // Given that NodeCrawler doesn't specify minimum value for  maxNodesPerRead/Browse
            crawler.maxNodesPerRead = 5;
            crawler.maxNodesPerBrowse = 10;
            await crawler.crawl(groupNodeId, { onBrowse: () => {/* empty */ } });
            // then NodeCrawler shall be set with value provided by itself
            crawler.maxNodesPerRead.should.eql(5);
            crawler.maxNodesPerBrowse.should.eql(10);
            crawler.dispose();
        }
        {
            const crawler = new NodeCrawler(session);
            // Given that NodeCrawler doesn't specify minimum value for  maxNodesPerRead/Browse
            // and greater than default value
            crawler.maxNodesPerRead = 501;
            crawler.maxNodesPerBrowse = 502;
            await crawler.crawl(groupNodeId, { onBrowse: () => {/* empty */ } });
            // then NodeCrawler shall be set with value provided by itself
            crawler.maxNodesPerRead.should.eql(501);
            crawler.maxNodesPerBrowse.should.eql(502);
            crawler.dispose();
        }

    });

    it("#655 it should send a browse event for each elements visited ", async () => {

        addressSpace.rootFolder.objects.server.serverCapabilities.operationLimits.maxNodesPerBrowse!.setValueFromSource({
            dataType: "UInt32", value: 100,
        });
        addressSpace.rootFolder.objects.server.serverCapabilities.operationLimits.maxNodesPerRead!.setValueFromSource({
            dataType: "UInt32", value: 1000,
        });

        const session = new PseudoSession(addressSpace);

        session.requestedMaxReferencesPerNode = 1000;

        const browse = sinon.spy(session, "browse");
        const browseNext = sinon.spy(session, "browseNext");
        const read = sinon.spy(session, "read");

        const crawler = new NodeCrawler(session);

        let results: string[] = [];

        let onBrowseCallCount = 0;
        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawler, cacheNode: CacheNode) {
                results.push(cacheNode.browseName.toString());
                followForward(crawler1, cacheNode, this);
                onBrowseCallCount += 1;
            }
        };

        await crawler.crawl(massVariablesNodeId, data);

        // tslint:disable: no-console
        console.log("onBrowse(element) count ", onBrowseCallCount);
        console.log("browse                  ", browse.callCount);
        console.log("browseNext              ", browseNext.callCount);
        console.log("read                    ", read.callCount);

        onBrowseCallCount.should.eql(1 + 10000 + 1);
        browse.callCount.should.eql(102); // 2 + 100*100
        browseNext.callCount.should.eql(10); // 10000*7
        read.callCount.should.eql(84); // 84*1000 => 8 read per node in average ?

        browse.restore();
        browseNext.restore();
        read.restore();

        results = [];

        crawler.dispose();

    });
    it("#717 it should populate nodeClass for each elements visited ", async () => {

        const session = new PseudoSession(addressSpace);

        const crawler = new NodeCrawler(session);

        let results: { browseName: string, nodeClass: string }[] = [];

        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawler, cacheNode: CacheNode) {
                results.push({
                    browseName: cacheNode.browseName.toString(),
                    nodeClass: NodeClass[cacheNode.nodeClass]
                });
                followForward(crawler1, cacheNode, this);
            }
        };

        await crawler.crawl(addressSpace.rootFolder.objects.server.nodeId, data);

        const countInvalidNodeClass1 = results.reduce((previous: number, current) => previous + ((current.nodeClass === "Unspecified") ? 1 : 0), 0);
        countInvalidNodeClass1.should.eql(0);

        results = [];
        await crawler.crawl(DataTypeIds.BaseDataType, data);
        const countInvalidNodeClass2 = results.reduce((previous: number, current) => previous + ((current.nodeClass === "Unspecified") ? 1 : 0), 0);
        countInvalidNodeClass2.should.eql(0);
        const countDataTypeNodeClass3 = results.reduce((previous: number, current) => previous + ((current.nodeClass === "DataType") ? 1 : 0), 0);
        countDataTypeNodeClass3.should.eql(1);
        // console.log(results);
        crawler.dispose();

    });
});
