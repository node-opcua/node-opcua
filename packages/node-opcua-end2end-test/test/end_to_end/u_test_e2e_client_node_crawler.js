const chalk = require("chalk");
const should = require("should");
const { assert } = require("node-opcua-assert");
const async = require("async");

const { ObjectIds, OPCUAClient, NodeCrawler, AttributeIds } = require("node-opcua");

const { redirectToFile } = require("node-opcua-debug/nodeJS");
const { make_debugLog } = require("node-opcua-debug");

const debugLog = make_debugLog("TEST");

function xredirectToFile(file, fun, callback) {
    fun(callback);
}

const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function (test) {
    describe("NodeCrawler", function () {
        let client, endpointUrl;

        // const nodeToCrawl = "ns=1;s=SimulationFolder";
        // makeNodeId(ObjectIds.Server);
        const nodeToCrawl = ObjectIds.PublishSubscribe;

        beforeEach(function (done) {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
            done();
        });

        afterEach(function (done) {
            client = null;
            done();
        });

        function MyDumpReference(reference) {
            function f(text, width) {
                return (text + "                                                     ").substring(0, width);
            }

            debugLog(
                "    referenceTypeId ",
                f(chalk.yellow(reference.referenceTypeId.displayText(), 35)) +
                    (reference.isForward ? " => " : " <= ") +
                    f(chalk.blue.bold(reference.browseName.name, 20)) +
                    "(" +
                    chalk.cyan(reference.nodeId.displayText()) +
                    ")"
            );
        }

        function myDumpReferences(index, references) {
            //xxx debugLog(" xxxxxxxxxxxxxxxxx ",references);
            references.forEach(MyDumpReference);
        }

        it("CRAWL1- should crawl for a complete tree", function (done) {
            redirectToFile(
                "NodeCrawler_complete_tree.log",
                function (done) {
                    perform_operation_on_client_session(
                        client,
                        endpointUrl,
                        function (session, done) {
                            const crawler = new NodeCrawler(session);

                            const data = {};
                            crawler
                                .on("browsed", function (nodeElement, data) {
                                    //xx debugLog(chalk.yellow("nodeElement "), nodeElement.browseName.toString(), nodeElement.nodeId.displayText());
                                    const objectIndex = {
                                        findNode: function (nodeId) {
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
                                    done(err);
                                });

                            crawler.crawl(nodeToCrawl, data, function (err) {
                                if (err) {
                                    return done(err);
                                }
                                crawler.crawl(nodeToCrawl, data, function (err) {
                                    crawler.dispose();
                                    done(err);
                                });
                            });
                        },
                        done
                    );
                },
                done
            );
        });

        it("CRAWL2- should crawl for a complete tree with limited node per browse and read request", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
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

                    crawler1.crawl(nodeToCrawl, data1, function (err) {
                        if (err) {
                            return done(err);
                        }
                        browsed_node1.should.be.greaterThan(10, "expecting more than 10 nodes being browsed");
                        browsed_node2.should.equal(0);

                        const data2 = { onBrowse: NodeCrawler.follow };
                        crawler2.crawl(nodeToCrawl, data2, function (err) {
                            if (err) {
                                return done(err);
                            }

                            browsed_node2.should.be.greaterThan(10);
                            browsed_node1.should.eql(browsed_node2, "crawler1 and crawler2 should browse the same number of node");

                            crawler1.dispose();
                            crawler2.dispose();
                            done();
                        });
                    });
                },
                done
            );
        });

        it("CRAWL3- should crawl one at a time", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                (session, done) => {
                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    crawler.read(nodeId, (err, obj) => {
                        if (!err) {
                            obj.organizes.forEach(function (o) {
                                // debugLog(o.browseName.toString());
                            });

                            obj.browseName.toString().should.equal("Root");
                            obj.organizes.length.should.equal(3);
                            obj.organizes[0].browseName.toString().should.eql("Objects");
                            obj.organizes[1].browseName.toString().should.eql("Types");
                            obj.organizes[2].browseName.toString().should.eql("Views");
                            obj.typeDefinition.should.eql("FolderType");
                        }
                        crawler.dispose();

                        done(err);
                    });
                },
                done
            );
        });

        it("CRAWL4- should crawl faster the second time", function (done) {
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, done) {
                    assert(typeof done === "function");

                    const crawler = new NodeCrawler(session);

                    const nodeId = "RootFolder";

                    const startTime = Date.now();

                    crawler.read(nodeId, (err, obj) => {
                        if (err) {
                            return done(err);
                        }

                        const intermediateTime1 = Date.now();
                        const duration1 = intermediateTime1 - startTime;

                        crawler.read(nodeId, (err, obj) => {
                            const intermediateTime2 = Date.now();
                            const duration2 = intermediateTime2 - intermediateTime1;

                            duration1.should.be.greaterThan(duration2);

                            crawler.dispose();
                            done(err);
                        });
                    });
                },
                done
            );
        });

        it("CRAWL5- should display a tree", function (done) {
            redirectToFile(
                "crawler_display_tree.log",
                function (inner_callback) {
                    perform_operation_on_client_session(
                        client,
                        endpointUrl,
                        function (the_session, callback) {
                            const crawler = new NodeCrawler(the_session);

                            crawler.on("browsed", function (element) {});

                            const nodeId = "ObjectsFolder";
                            debugLog("now crawling object folder ...please wait...");
                            crawler.read(nodeId, function (err, obj) {
                                if (!err) {
                                    /*
                                treeify.asLines(obj, true, true, function(line) {
                                    debugLog(line);
                                });
                            */
                                }
                                crawler.dispose();
                                callback(err);
                            });
                        },
                        inner_callback
                    );
                },
                done
            );
        });

        it("CRAWL6 - ServerStatusType_ShutdownReason", async () => {
            const client = OPCUAClient.create();
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
