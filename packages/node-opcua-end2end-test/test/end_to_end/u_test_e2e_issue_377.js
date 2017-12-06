/* global describe, it, require*/
"use strict";

var should = require("should");

var opcua = require("node-opcua");

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var redirectToFile = require("node-opcua-debug").redirectToFile;

module.exports = function (test) {


    describe("Testing a server that exposes a node whose string nodeId looks like a guid", function () {

        before(function (done) {
            var server = test.server;

            var addressSpace = server.engine.addressSpace;

            var nodeId = new opcua.NodeId(opcua.NodeIdType.STRING, "1cf5e1fa-202a-2ab8-0440-c4fc2f22f2bf");
            addressSpace.addObject({
                browseName: "Node377",
                nodeId: nodeId,
                organizedBy: addressSpace.rootFolder.objects
            });

            done();
        });
        it("#377 a client should get confused with string nodeid that looks like a guid", function (done) {

            var server = test.server;

            if (!server) {
                return done();
            }

            var client = new opcua.OPCUAClient({});

            perform_operation_on_client_session(client, test.endpointUrl, function (session, callback) {

                var browseDesc = {
                    nodeId: "ObjectsFolder",
                    referenceTypeId: null,
                    browseDirection: opcua.BrowseDirection.Forward
                };
                session.browse(browseDesc, function (err, results) {
                    if (err) {
                        return callback(err);
                    }
                    var nodeIds = results[0].references.map(function (a) {
                        return a.nodeId;
                    });

                    nodeIds[nodeIds.length - 1].toString().should.eql("ns=0;s=1cf5e1fa-202a-2ab8-0440-c4fc2f22f2bf");
                    callback();
                });

            }, done);

        });

    });

};
