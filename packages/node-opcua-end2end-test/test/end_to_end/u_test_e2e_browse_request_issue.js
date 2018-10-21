/* global describe, beforeEach, afterEach , it */
"use strict";
const should = require("should");
const async = require("async");

const opcua = require("node-opcua");
const resolveNodeId = opcua.resolveNodeId;

const OPCUAClient = opcua.OPCUAClient;
const StatusCodes = opcua.StatusCodes;

const BrowseDirection = opcua.BrowseDirection;

module.exports = function (test) {

    describe("QSD Test Browse Request", function () {

        let client, endpointUrl;

        let g_session = null;
        beforeEach(function (done) {

            endpointUrl = test.endpointUrl;

            client = OPCUAClient.create();
            client.connect(endpointUrl, function (err) {
                if (err) {
                    done(err);
                }
                else {
                    client.createSession(function (err, session) {
                        g_session = session;
                        done(err);
                    });
                }
            });

        });

        afterEach(function (done) {
            g_session.close(function () {
                client.disconnect(done);
            });
        });


        it("T6 - #BrowseNext response ", function (done) {

            const nodeToBrowse = {
                nodeId: resolveNodeId("i=29"),
                referenceTypeId: null,
                includeSubtypes: false,
                browseDirection: BrowseDirection.Forward,
                resultMask: 63,
                nodeClassMask: 255
            };

            let allReferences;
            async.series([

                function (callback) {
                    const browseRequest1 = new opcua.BrowseRequest({
                        view: null,
                        requestedMaxReferencesPerNode: 0,
                        nodesToBrowse: [nodeToBrowse]
                    });
                    g_session.performMessageTransaction(browseRequest1, function (err, response) {
                        if (err) {
                            return callback(err);
                        }
                        // console.log(response.toString());
                        response.results[0].statusCode.should.eql(StatusCodes.Good);
                        response.results[0].references.length.should.be.greaterThan(3); // want 4 at lest
                        should(response.results[0].continuationPoint).eql(null);
                        allReferences = response.results[0].references;
                        callback();
                    });
                },
                function (callback) {
                    callback();
                }
            ], done);

        });
    });
};