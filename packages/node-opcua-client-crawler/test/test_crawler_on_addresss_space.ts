import sinon from "sinon";

import { AddressSpace, BaseNode, PseudoSession, UAVariable } from "node-opcua-address-space";
import { getMiniAddressSpace } from "node-opcua-address-space/testHelpers";
import { ObjectIds, DataTypeIds, ReferenceTypeIds } from "node-opcua-constants";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
import { makeNodeId, NodeId, resolveNodeId } from "node-opcua-nodeid";
import {
    DataType,
    ReferenceDescription} from "node-opcua-client";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { CacheNode, NodeCrawlerBase, UserData } from "..";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

async function makeAddressSpace() {
    const addressSpace = await getMiniAddressSpace();

    addressSpace.isFrugal = true;

    const namespace = addressSpace.getOwnNamespace();

    const isLinkWithRef = namespace.addReferenceType({
        browseName: "IsLinkedWith",
        inverseName: "IsLinkedWith",
        subtypeOf: resolveNodeId(ReferenceTypeIds.NonHierarchicalReferences)
    });
    const group = namespace.addObject({
        browseName: "Group",
        organizedBy: addressSpace.rootFolder.objects
    });

    for (let i = 0; i < 10; i++) {
        addressSpace.getOwnNamespace().addObject({
            browseName: "Object" + i,
            organizedBy: group
        });
    }
    const groupNodeId = group.nodeId;

    const massVariables = namespace.addObject({
        browseName: "MassVariables",
        nodeId: "s=MassVariables",
        organizedBy: addressSpace.rootFolder.objects
    });
    const massVariablesNodeId = massVariables.nodeId;
    for (let i = 0; i < 10000; i++) {
        namespace.addVariable({
            browseName: "Variable" + i,
            dataType: "Double",
            organizedBy: massVariables,
            value: { dataType: "Double", value: i }
        });
    }
    const largeVariableWithLinks = namespace.addObject({
        browseName: "StrangeObject",
        organizedBy: addressSpace.rootFolder.objects
    });
    const strangeObjectNodeId = largeVariableWithLinks.nodeId;
    function addSubObject(parent: BaseNode, name: string) {
        const subObject = namespace.addVariable({
            browseName: name,
            dataType: "String",
            componentOf: parent,
            value: { dataType: "String", value: name }
        });
        for (let i = 0; i < 10; i++) {
            const m = namespace.addVariable({
                browseName: name + "-" + i,
                dataType: "Double",
                componentOf: subObject,
                value: { dataType: "Double", value: i }
            });
            m.addReference({
                referenceType: isLinkWithRef,
                nodeId: parent
            });
            parent.addReference({
                referenceType: isLinkWithRef,
                //         isForward: false,
                nodeId: m
            });
        }
    }
    for (let i = 0; i < 100; i++) {
        addSubObject(largeVariableWithLinks, "SubObject" + i);
    }
    return { addressSpace, groupNodeId, massVariablesNodeId, strangeObjectNodeId };
}
describe("NodeCrawlerBase", function (this: any) {
    this.timeout(200000);

    let $: { addressSpace: AddressSpace; groupNodeId: NodeId; massVariablesNodeId: NodeId; strangeObjectNodeId: NodeId };
    before(async () => {
        $ = await makeAddressSpace();
    });
    after(() => {
        if ($ && $.addressSpace) {
            $.addressSpace.dispose();
        }
    });

    function followForward(crawler: NodeCrawlerBase, cacheNode: CacheNode, userData: UserData) {
        NodeCrawlerBase.follow(crawler, cacheNode, userData, "Organizes", BrowseDirection.Forward);
        NodeCrawlerBase.follow(crawler, cacheNode, userData, "HasComponent", BrowseDirection.Forward);
        NodeCrawlerBase.follow(crawler, cacheNode, userData, "HasProperty", BrowseDirection.Forward);

        // for (const reference  of cacheNode.references) {
        //    if (reference.isForward && reference.referenceTypeId.toString() === "i=35") {
        //        debugLog( cacheNode.browseName, reference.isForward, reference.nodeId.toString());
        //        crawler.followReference(cacheNode, reference, userData);
        //    }
        // }
    }


    it("CRAWL1 should crawl on a PseudoSession", async () => {
        const session = new PseudoSession($.addressSpace);

        const crawler = new NodeCrawlerBase(session);

        const results: string[] = [];

        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawlerBase, cacheNode: CacheNode) {
                results.push(cacheNode.browseName.toString());
                followForward(crawler1, cacheNode, this);
            }
        };
        const nodeId = makeNodeId(ObjectIds.Server_ServerCapabilities); // server

        await crawler.crawl(nodeId, data);

        results
            .sort()
            .join(" ")
            .should.eql(
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
                "ServerCapabilities"
            );

        crawler.dispose();
    });

    it("CRAWL2 should crawl a very large number of nodes", async () => {
        const session = new PseudoSession($.addressSpace);

        (session as any).browse = sinon.spy(session, "browse");
        (session as any).browseNext = sinon.spy(session, "browseNext");
        (session as any).read = sinon.spy(session, "read");

        const crawler = new NodeCrawlerBase(session);
        crawler.maxNodesPerBrowse = 5;
        const results: string[] = [];

        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawlerBase, cacheNode: CacheNode) {
                results.push(cacheNode.browseName.toString());
                followForward(crawler1, cacheNode, this);
                // NodeCrawlerBase.follow(crawler1, cacheNode, this, "Organizes");
            }
        };

        await crawler.crawl($.groupNodeId, data);

        results
            .sort()
            .join(" ")
            .should.eql(
                "1:Group 1:Object0 1:Object1 " +
                "1:Object2 1:Object3 1:Object4 " +
                "1:Object5 1:Object6 1:Object7 " +
                "1:Object8 1:Object9 Organizes"
            );

        // tslint:disable: no-console
        debugLog("browseCounter = ", crawler.browseCounter);
        debugLog("browseNextCounter = ", crawler.browseNextCounter);
        debugLog("readCounter = ", crawler.readCounter);
        // crawler.browseNextCounter.should.be.greaterThan(0);
        crawler.dispose();
    });

    it("CRAWL3 issue #655: it should used provided MaxNodePerRead/MaxNodePerBrowse as a minimum value when set <> 0 and server provide limits", async () => {
        // Given a server that provides some limit for MaxNodesPerRead && MaxNodesPerBrowse
        const maxNodesPerReadVar = $.addressSpace.findNode(
            "Server_ServerCapabilities_OperationLimits_MaxNodesPerRead"
        )! as UAVariable;
        const maxNodesPerBrowseVar = $.addressSpace.findNode(
            "Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse"
        )! as UAVariable;

        maxNodesPerReadVar.setValueFromSource({ dataType: DataType.UInt32, value: 251 });
        maxNodesPerBrowseVar.setValueFromSource({ dataType: DataType.UInt32, value: 252 });
        maxNodesPerReadVar.readValue().value.value.should.eql(251);
        maxNodesPerBrowseVar.readValue().value.value.should.eql(252);

        const session = new PseudoSession($.addressSpace);

        {
            // Given that NodeCrawlerBase doesn't specify minimum value for  maxNodesPerRead/Browse
            const crawler = new NodeCrawlerBase(session);
            crawler.maxNodesPerRead = 0;
            crawler.maxNodesPerBrowse = 0;
            await crawler.crawl($.groupNodeId, {
                onBrowse: () => {
                    /* empty */
                }
            });

            // then NodeCrawlerBase shall be set with value provided by server
            crawler.maxNodesPerRead.should.eql(251);
            crawler.maxNodesPerBrowse.should.eql(252);
            crawler.dispose();
        }

        {
            // Given that NodeCrawlerBase does  specify minimum value for  maxNodesPerRead/Browse
            // which are below server provided limit
            const crawler = new NodeCrawlerBase(session);
            crawler.maxNodesPerRead = 5;
            crawler.maxNodesPerBrowse = 10;
            await crawler.crawl($.groupNodeId, {
                onBrowse: () => {
                    /* empty */
                }
            });
            // then NodeCrawlerBase shall be set with value provided by itself
            crawler.maxNodesPerRead.should.eql(5);
            crawler.maxNodesPerBrowse.should.eql(10);
            crawler.dispose();
        }
        {
            // Given that NodeCrawlerBase does  specify minimum value for  maxNodesPerRead/Browse
            // which are above server provided limit
            const crawler = new NodeCrawlerBase(session);
            crawler.maxNodesPerRead = 501;
            crawler.maxNodesPerBrowse = 502;
            await crawler.crawl($.groupNodeId, {
                onBrowse: () => {
                    /* empty */
                }
            });
            // then NodeCrawlerBase shall be set with value provided by server
            crawler.maxNodesPerRead.should.eql(251);
            crawler.maxNodesPerBrowse.should.eql(252);
            crawler.dispose();
        }
    });
    it("CRAWL4 issue #655: it should used provided MaxNodePerRead/MaxNodePerBrowse as a minimum value when set <> 0 and server do not provide limits", async () => {
        // Given a server that DOES NOT provide some limit for MaxNodesPerRead && MaxNodesPerBrowse
        const maxNodesPerReadVar = $.addressSpace.findNode(
            "Server_ServerCapabilities_OperationLimits_MaxNodesPerRead"
        )! as UAVariable;
        const maxNodesPerBrowseVar = $.addressSpace.findNode(
            "Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse"
        )! as UAVariable;

        maxNodesPerReadVar.setValueFromSource({ dataType: DataType.UInt32, value: 0 });
        maxNodesPerBrowseVar.setValueFromSource({ dataType: DataType.UInt32, value: 0 });

        maxNodesPerReadVar.readValue().value.value.should.eql(0);
        maxNodesPerBrowseVar.readValue().value.value.should.eql(0);

        const session = new PseudoSession($.addressSpace);

        {
            // Given that NodeCrawlerBase doesn't specify minimum value for  maxNodesPerRead/Browse
            const crawler = new NodeCrawlerBase(session);
            crawler.maxNodesPerRead = 0;
            crawler.maxNodesPerBrowse = 0;
            // then NodeCrawlerBase shall be set with default value provided by NodeCrawlerBase
            await crawler.crawl($.groupNodeId, {
                onBrowse: () => {
                    /* empty */
                }
            });
            crawler.maxNodesPerRead.should.eql(100);
            crawler.maxNodesPerBrowse.should.eql(100);
            crawler.dispose();
        }

        {
            const crawler = new NodeCrawlerBase(session);
            // Given that NodeCrawlerBase doesn't specify minimum value for  maxNodesPerRead/Browse
            crawler.maxNodesPerRead = 5;
            crawler.maxNodesPerBrowse = 10;
            await crawler.crawl($.groupNodeId, {
                onBrowse: () => {
                    /* empty */
                }
            });
            // then NodeCrawlerBase shall be set with value provided by itself
            crawler.maxNodesPerRead.should.eql(5);
            crawler.maxNodesPerBrowse.should.eql(10);
            crawler.dispose();
        }
        {
            const crawler = new NodeCrawlerBase(session);
            // Given that NodeCrawlerBase doesn't specify minimum value for  maxNodesPerRead/Browse
            // and greater than default value
            crawler.maxNodesPerRead = 501;
            crawler.maxNodesPerBrowse = 502;
            await crawler.crawl($.groupNodeId, {
                onBrowse: () => {
                    /* empty */
                }
            });
            // then NodeCrawlerBase shall be set with value provided by itself
            crawler.maxNodesPerRead.should.eql(501);
            crawler.maxNodesPerBrowse.should.eql(502);
            crawler.dispose();
        }
    });

    it("CRAWL5 #655 it should send a browse event for each elements visited ", async () => {
        $.addressSpace.rootFolder.objects.server.serverCapabilities!.operationLimits!.maxNodesPerBrowse!.setValueFromSource({
            dataType: "UInt32",
            value: 100
        });
        $.addressSpace.rootFolder.objects.server.serverCapabilities!.operationLimits!.maxNodesPerRead!.setValueFromSource({
            dataType: "UInt32",
            value: 1000
        });

        const session = new PseudoSession($.addressSpace);

        session.maxBrowseContinuationPoints = 10;
        session.requestedMaxReferencesPerNode = 2;

        const browse = sinon.spy(session, "browse");
        const browseNext = sinon.spy(session, "browseNext");
        const read = sinon.spy(session, "read");

        const crawler = new NodeCrawlerBase(session);

        let results: string[] = [];

        let onBrowseCallCount = 0;
        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawlerBase, cacheNode: CacheNode) {
                results.push(cacheNode.browseName.toString());
                followForward(crawler1, cacheNode, this);
                onBrowseCallCount += 1;
            }
        };

        await crawler.crawl($.massVariablesNodeId, data);

        // tslint:disable: no-console
        debugLog("onBrowse(element) count ", onBrowseCallCount);
        debugLog("browse                  ", browse.callCount);
        debugLog("browseNext              ", browseNext.callCount);
        debugLog("read                    ", read.callCount);

        onBrowseCallCount.should.eql(1 + 10000 + 1);
        browse.callCount.should.eql(1002); // 2 + 100*100
        //xxxxxx browseNext.callCount.should.eql(10); // 10000*7
        read.callCount.should.eql(186); // 84*1000 => 8 read per node in average ?

        browse.restore();
        browseNext.restore();
        read.restore();

        results = [];

        crawler.dispose();
    });

    it("CRAWL6 #717 it should populate nodeClass for each elements visited ", async () => {
        const session = new PseudoSession($.addressSpace);

        const crawler = new NodeCrawlerBase(session);

        let results: { browseName: string; nodeClass: string }[] = [];

        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawlerBase, cacheNode: CacheNode) {
                results.push({
                    browseName: cacheNode.browseName.toString(),
                    nodeClass: NodeClass[cacheNode.nodeClass]
                });
                followForward(crawler1, cacheNode, this);
            }
        };

        await crawler.crawl($.addressSpace.rootFolder.objects.server.nodeId, data);

        const countInvalidNodeClass1 = results.reduce(
            (previous: number, current) => previous + (current.nodeClass === "Unspecified" ? 1 : 0),
            0
        );
        countInvalidNodeClass1.should.eql(0);

        results = [];
        await crawler.crawl(DataTypeIds.BaseDataType, data);
        const countInvalidNodeClass2 = results.reduce(
            (previous: number, current) => previous + (current.nodeClass === "Unspecified" ? 1 : 0),
            0
        );
        countInvalidNodeClass2.should.eql(0);
        const countDataTypeNodeClass3 = results.reduce(
            (previous: number, current) => previous + (current.nodeClass === "DataType" ? 1 : 0),
            0
        );
        countDataTypeNodeClass3.should.eql(1);
        // debugLog(results);
        crawler.dispose();
    });

    function followForwardAll(crawler: NodeCrawlerBase, cacheNode: CacheNode, userData: UserData) {
        for (const reference of cacheNode.references) {
            if (reference.isForward && reference.nodeId.namespace !== 0) {
                crawler.followReference(cacheNode, reference, userData);
            }
        }
    }
    it("CRAWL7 - ", async () => {
        const session = new PseudoSession($.addressSpace);
        (session as any).browse = sinon.spy(session, "browse");
        (session as any).browseNext = sinon.spy(session, "browseNext");
        (session as any).read = sinon.spy(session, "read");
   
        const crawler = new NodeCrawlerBase(session);

        const results: { browseName: string; nodeClass: string; nodeId: NodeId; references: ReferenceDescription[] }[] = [];
        const data = {
            onBrowse(this: UserData, crawler1: NodeCrawlerBase, cacheNode: CacheNode) {
                results.push({
                    browseName: cacheNode.browseName.toString(),
                    nodeClass: NodeClass[cacheNode.nodeClass],
                    nodeId: cacheNode.nodeId,
                    references: cacheNode.references
                });
                followForwardAll(crawler1, cacheNode, this);
            }
        };

        crawler.maxNodesPerBrowse = 2;
        crawler.maxNodesPerRead = 100;
        session.requestedMaxReferencesPerNode = 10;
        await crawler.crawl($.strangeObjectNodeId, data);

        console.log("Here !");
        crawler.dispose();
        for (const r of results) {
            //    console.log(r.browseName.toString(), r.nodeId.toString(), r.references.length);
        }
        results.length.should.eql(1103);

        console.log("read      ", (session as any).read.callCount);
        console.log("browse    ", (session as any).browse.callCount);
        console.log("browseNext", (session as any).browseNext.callCount);

    });
});
