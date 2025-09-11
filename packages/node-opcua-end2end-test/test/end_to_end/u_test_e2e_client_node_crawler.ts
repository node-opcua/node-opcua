import chalk from "chalk";
import "should";
import { assert } from "node-opcua-assert";
import { ObjectIds, OPCUAClient, AttributeIds, NodeIdLike, ErrorCallback } from "node-opcua";
import { NodeCrawler, UserData } from "node-opcua-client-crawler";
import { redirectToFile } from "node-opcua-debug/nodeJS";
import { make_debugLog } from "node-opcua-debug";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";


async function redirectToFileAsync(filename: string, f: () => Promise<void>) {

    await new Promise<void>((resolve, reject) => {
        redirectToFile(filename, (callback: ErrorCallback) => {
            f().then(() => callback(undefined)).catch((err) => callback(err));
        }, (err) => {
            err ? reject(err) : resolve();
        });
    });
}
const debugLog = make_debugLog("TEST");
export function t(test: any) {
    describe("NodeCrawler", function () {
        let client: OPCUAClient;
        let endpointUrl: string;

        // const nodeToCrawl = "ns=1;s=SimulationFolder";
        // makeNodeId(ObjectIds.Server);
        const nodeToCrawl = ObjectIds.PublishSubscribe;

        beforeEach(() => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
        });

        afterEach(() => {
        });

        function MyDumpReference(reference: any) {
            function f(text: string, width: number) {
                return (text + "                                                     ").substring(0, width);
            }

            debugLog(
                "    referenceTypeId ",
                f(chalk.yellow(reference.referenceTypeId.displayText()), 35) +
                (reference.isForward ? " => " : " <= ") +
                f(chalk.blue.bold(reference.browseName.name), 20) +
                "(" +
                chalk.cyan(reference.nodeId.displayText()) +
                ")"
            );
        }

        function myDumpReferences(index: any, references: any[]) {
            //xxx debugLog(" xxxxxxxxxxxxxxxxx ",references);
            references.forEach(MyDumpReference);
        }

        it("CRAWL1- should crawl for a complete tree", async () => {
            await redirectToFileAsync(
                "NodeCrawler_complete_tree.log",
                async () => {
                    await perform_operation_on_client_session(
                        client,
                        endpointUrl,
                        async (session) => {
                            const crawler = new NodeCrawler(session);

                            const data: UserData = {
                                onBrowse: () => {

                                }
                            };
                            crawler
                                .on("browsed", function (nodeElement, data) {
                                    //xx debugLog(chalk.yellow("nodeElement "), nodeElement.browseName.toString(), nodeElement.nodeId.displayText());
                                    const objectIndex = {
                                        findNode: (nodeId: NodeIdLike) => {
                                            return null;
                                        }
                                    };
                                    debugLog(" Node => ", nodeElement.browseName.toString(), nodeElement.nodeId.toString());
                                    myDumpReferences(objectIndex, nodeElement.references);
                                })
                                .on("end", function () {
                                    debugLog("Data ", data);
                                })
                                .on("error", function (err) {

                                });

                            await crawler.crawl(nodeToCrawl, data);

                            await crawler.crawl(nodeToCrawl, data);

                            crawler.dispose();
                        });
                });
        });

        it("CRAWL2- should crawl for a complete tree with limited node per browse and read request", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    // crawler 1 has no limit in the number of node inside Browse or Read request
                    const crawler1 = new NodeCrawler(session);
                    assert(crawler1.maxNodesPerRead === 0);
                    assert(crawler1.maxNodesPerBrowse === 0);

                    // crawler 2 has a limit of 3 nodes inside Browse or Read request
                    const crawler2 = new NodeCrawler(session);
                    crawler2.maxNodesPerRead = 3;
                    crawler2.maxNodesPerBrowse = 3;

                    let browsed_node1 = 0;
                    let browsed_node2 = 0;
                    crawler1.on("browsed", (nodeElement, data) => {
                        browsed_node1++;
                    });
                    crawler2.on("browsed", (nodeElement, data) => {
                        browsed_node2++;
                    });
                    const data1 = { onBrowse: NodeCrawler.follow };

                    await crawler1.crawl(nodeToCrawl, data1);
                    browsed_node1.should.be.greaterThan(10, "expecting more than 10 nodes being browsed");
                    browsed_node2.should.equal(0);

                    const data2 = { onBrowse: NodeCrawler.follow };

                    await crawler2.crawl(nodeToCrawl, data2);

                    browsed_node2.should.be.greaterThan(10);
                    browsed_node1.should.eql(browsed_node2, "crawler1 and crawler2 should browse the same number of node");

                    crawler1.dispose();
                    crawler2.dispose();
                });
        });

        it("CRAWL3- should crawl one at a time", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    const obj: any = await crawler.read(nodeId);
                    obj.organizes.forEach((o: any) => {
                        // debugLog(o.browseName.toString());
                    });

                    obj.browseName.toString().should.equal("Root");
                    obj.organizes.length.should.equal(3);
                    obj.organizes[0].browseName.toString().should.eql("Objects");
                    obj.organizes[1].browseName.toString().should.eql("Types");
                    obj.organizes[2].browseName.toString().should.eql("Views");
                    obj.typeDefinition.should.eql("FolderType");

                    crawler.dispose();
                });
        });

        it("CRAWL4- should crawl faster the second time", async () => {
            await perform_operation_on_client_session(
                client,
                endpointUrl,
                async (session) => {
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    const startTime = Date.now();

                    const obj1 = await crawler.read(nodeId);

                    const intermediateTime1 = Date.now();
                    const duration1 = intermediateTime1 - startTime;

                    const obj2 = crawler.read(nodeId);
                    const intermediateTime2 = Date.now();
                    const duration2 = intermediateTime2 - intermediateTime1;

                    duration1.should.be.greaterThan(duration2);

                    crawler.dispose();
                });
        });

        it("CRAWL5- should display a tree", async () => {
            await redirectToFileAsync(
                "crawler_display_tree.log",
                async () => {
                    await perform_operation_on_client_session(
                        client,
                        endpointUrl,
                        async (the_session) => {
                            const crawler = new NodeCrawler(the_session);

                            crawler.on("browsed", function (element) { });

                            const nodeId = "ObjectsFolder";
                            debugLog("now crawling object folder ...please wait...");

                            const obj = await crawler.read(nodeId);
                            crawler.dispose();
                        });
                });
        });

        it("CRAWL6 - ServerStatusType_ShutdownReason", async () => {
            const client = OPCUAClient.create({});
            await client.withSessionAsync(endpointUrl, async (session) => {
                const nodeId = "ns=0;i=2753";
                // ServerStatusType_ShutdownReason;
                const dataValues = await session.read([
                    { nodeId, attributeId: AttributeIds.ValueRank },
                    { nodeId, attributeId: AttributeIds.ArrayDimensions },
                    { nodeId, attributeId: AttributeIds.Value }
                ]);
                console.log(dataValues[0].toString());
                console.log(dataValues[1].toString());
                console.log(dataValues[2].toString());
            });
        });
    });
};
