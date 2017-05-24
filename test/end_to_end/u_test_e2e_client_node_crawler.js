require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var _ = require("underscore");
var util = require("util");


var opcua = require("index");
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var browse_service = opcua.browse_service;
var NodeCrawler = opcua.NodeCrawler;


var redirectToFile = require("lib/misc/utils").redirectToFile;
var debugLog = require("lib/misc/utils").make_debugLog(__filename);

function xredirectToFile(file, fun, callback) {
    fun(callback);
}

var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;

var nodeToCrawl = opcua.makeNodeId(opcua.ObjectIds.Server);

module.exports = function (test) {

    describe("NodeCrawler", function () {

        var client, endpointUrl;


        beforeEach(function (done) {
            client = new OPCUAClient();
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

            console.log("    referenceTypeId ",
                f(reference.referenceTypeId.displayText(), 35).yellow +
                (  reference.isForward ? " => " : " <= ") +
                f(reference.browseName.name, 20).blue.bold +
                "(" + reference.nodeId.displayText().cyan + ")"
            );
        }

        function myDumpReferences(index, references) {
            //xxx console.log(" xxxxxxxxxxxxxxxxx ",references);
            references.forEach(MyDumpReference);
        }


        it("CRAWL1- should crawl for a complete tree", function (done) {

            redirectToFile("NodeCrawler_complete_tree.log", function (done) {

                perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                    var crawler = new NodeCrawler(session);

                    var data = {};
                    crawler.on("browsed", function (nodeElement, data) {

                        //xx console.log("nodeElement ".yellow, nodeElement.browseName.toString(), nodeElement.nodeId.displayText());
                        var objectIndex = {
                            findNode: function (nodeId) {
                                return null;
                            }
                        };
                        console.log(" Node => ",nodeElement.browseName.toString(), nodeElement.nodeId.toString());
                        myDumpReferences(objectIndex, nodeElement.references);

                    }).on("end", function () {
                        console.log("Data ", data);
                    }).on("error", function (err) {
                        done(err);
                    });

                    crawler.crawl(nodeToCrawl, data, function (err) {
                        if (err) {
                            return done(err);
                        }
                        crawler.crawl(nodeToCrawl, data, function (err) {
                            done(err);
                        });

                    });


                }, done);
            }, done);
        });

        it("CRAWL2- should crawl for a complete tree with limited node per browse and read request", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                // crawler 1 has no limit in the number of node inside Browse or Read request
                var crawler1 = new NodeCrawler(session);
                assert(crawler1.maxNodesPerRead === 0);
                assert(crawler1.maxNodesPerBrowse === 0);

                // crawler 2 has a limit of 3 nodes inside Browse or Read request
                var crawler2 = new NodeCrawler(session);
                crawler2.maxNodesPerRead = 3;
                crawler2.maxNodesPerBrowse = 3;

                var browsed_node1 = 0;
                var browsed_node2 = 0;
                crawler1.on("browsed", function (nodeElement, data) {
                    browsed_node1++;
                });
                crawler2.on("browsed", function (nodeElement, data) {
                    browsed_node2++;
                });
                var data1 = {onBrowse: NodeCrawler.follow};

                crawler1.crawl(nodeToCrawl, data1, function (err) {
                    if (err) {
                        return done(err);
                    }
                    browsed_node1.should.be.greaterThan(10, "expecting more than 10 nodes being browsed");
                    browsed_node2.should.equal(0);

                    var data2 = {onBrowse: NodeCrawler.follow};
                    crawler2.crawl(nodeToCrawl, data2, function (err) {
                        if (err) {
                            return done(err);
                        }

                        browsed_node2.should.be.greaterThan(10);
                        browsed_node1.should.eql(browsed_node2, "crawler1 and crawler2 should browse the same number of node");
                        done();
                    });
                });
            }, done);
        });

        it("CRAWL3- should crawl one at a time", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                assert(_.isFunction(done));

                var crawler = new NodeCrawler(session);

                var nodeId = "RootFolder";
                crawler.read(nodeId, function (err, obj) {

                    if (!err) {

                        obj.organizes.forEach(function(o) {
                            console.log(o.browseName.toString());
                        });

                        obj.browseName.toString().should.equal("Root");
                        obj.organizes.length.should.equal(3);
                        obj.organizes[0].browseName.toString().should.eql("Objects");
                        obj.organizes[1].browseName.toString().should.eql("Types");
                        obj.organizes[2].browseName.toString().should.eql("Views");
                        obj.typeDefinition.should.eql("FolderType");
                    }
                    done(err);
                });
            }, done);
        });

        it("CRAWL4- should crawl faster the second time", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, done) {

                assert(_.isFunction(done));

                var crawler = new NodeCrawler(session);

                var nodeId = "RootFolder";

                var startTime = Date.now();

                crawler.read(nodeId, function (err, obj) {

                    if (err) {
                        return done(err);
                    }

                    var intermediateTime1 = Date.now();
                    var duration1 = intermediateTime1 - startTime;


                    crawler.read(nodeId, function (err, obj) {
                        var intermediateTime2 = Date.now();
                        var duration2 = intermediateTime2 - intermediateTime1;

                        duration1.should.be.greaterThan(duration2);

                        done(err);
                    });

                });
            }, done);
        });

        it("CRAWL5- should display a tree", function (done) {

            var redirectToFile = require("lib/misc/utils").redirectToFile;

            redirectToFile("crawler_display_tree.log", function (inner_callback) {

                var treeify = require('treeify');

                perform_operation_on_client_session(client, endpointUrl, function (the_session, callback) {

                    var crawler = new NodeCrawler(the_session);

                    crawler.on("browsed", function (element) {
                    });

                    var nodeId = "ObjectsFolder";
                    console.log("now crawling object folder ...please wait...");
                    crawler.read(nodeId, function (err, obj) {
                        if (!err) {
                            treeify.asLines(obj, true, true, function (line) {
                                console.log(line);
                            });
                        }
                        callback(err);
                    });

                }, inner_callback);
            }, done);

        });

    });
};