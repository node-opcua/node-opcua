/* global describe, it, require*/
"use strict";

const should = require("should");

const opcua = require("node-opcua");

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
const redirectToFile = require("node-opcua-debug").redirectToFile;

module.exports = function (test) {


    describe("Testing a server that exposes a node whose string nodeId looks like a guid", function () {

        before(function (done) {
            const server = test.server;

            const addressSpace = server.engine.addressSpace;
            const namespace = addressSpace.getOwnNamespace();

            const nodeId = new opcua.NodeId(opcua.NodeIdType.STRING, "1cf5e1fa-202a-2ab8-0440-c4fc2f22f2bf",1);
            namespace.addObject({
                browseName: "Node377",
                nodeId: nodeId,
                organizedBy: addressSpace.rootFolder.objects
            });

            done();
        });
        it("#377 a client should get confused with string nodeid that looks like a guid", function (done) {

            const server = test.server;

            if (!server) {
                return done();
            }

            const client = opcua.OPCUAClient.create({});

            perform_operation_on_client_session(client, test.endpointUrl, function (session, callback) {

                const browseDesc = {
                    nodeId: "ObjectsFolder",
                    referenceTypeId: null,
                    browseDirection: opcua.BrowseDirection.Forward
                };
                session.browse(browseDesc, function (err, browseResult) {
                    if (err) {
                        return callback(err);
                    }
                    const nodeIds = browseResult.references.map(function (a) {
                        return a.nodeId;
                    });
                    nodeIds[nodeIds.length - 1].toString().should.eql("ns=1;s=1cf5e1fa-202a-2ab8-0440-c4fc2f22f2bf");
                    callback();
                });

            }, done);

        });

    });

};
