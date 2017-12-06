"use strict";
/*global describe, it, require, beforeEach, afterEach */

var should = require("should");

var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var makeBrowsePath = opcua.makeBrowsePath;

var perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {


    describe("testing session#translateBrowsePath", function () {

        var server, client, endpointUrl;

        beforeEach(function (done) {
            client = new OPCUAClient();
            endpointUrl = test.endpointUrl;
            server = test.server;
            done();
        });

        afterEach(function (done) {

            client = null;
            done();
        });


        it("TBP1 should translate browse path", function (done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                // find nodeId of Root.Objects.server.status.buildInfo
                var browsePath = [
                    makeBrowsePath("RootFolder","/Objects/Server"),
                    makeBrowsePath("RootFolder","/Objects/Server.ServerStatus"),
                    makeBrowsePath("RootFolder","/Objects/Server.ServerStatus.BuildInfo"),
                    makeBrowsePath("RootFolder","/Objects/Server.ServerStatus.BuildInfo.ProductName"),
                    makeBrowsePath("RootFolder","/Objects/Server.ServerStatus.BuildInfo."), // missing TargetName !
                    makeBrowsePath("RootFolder","/Objects.Server"), // intentional error usign . instead of /
                    makeBrowsePath("RootFolder","/Objects/2:MatrikonOPC Simulation Server (DA)") // va
                ];

                //xx console.log("browsePath ", browsePath[0].toString({addressSpace: server.engine.addressSpace}));

                session.translateBrowsePath(browsePath, function (err, results) {

                    if (!err) {
                        results.length.should.eql(browsePath.length);
                        //xx console.log(results[0].toString());

                        results[0].statusCode.should.eql(StatusCodes.Good);
                        results[0].targets.length.should.eql(1);
                        results[0].targets[0].targetId.toString().should.eql("ns=0;i=2253");
                        results[0].targets[0].targetId.value.should.eql(opcua.ObjectIds.Server);

                        //xx console.log(results[1].toString());
                        results[1].statusCode.should.eql(StatusCodes.Good);
                        results[1].targets.length.should.eql(1);
                        results[1].targets[0].targetId.toString().should.eql("ns=0;i=2256");
                        results[1].targets[0].targetId.value.should.eql(opcua.VariableIds.Server_ServerStatus);

                        //xx console.log(results[2].toString());
                        results[2].statusCode.should.eql(StatusCodes.Good);
                        results[2].targets.length.should.eql(1);
                        results[2].targets[0].targetId.toString().should.eql("ns=0;i=2260");
                        results[2].targets[0].targetId.value.should.eql(opcua.VariableIds.Server_ServerStatus_BuildInfo);

                        //xx console.log(results[3].toString());
                        results[3].statusCode.should.eql(StatusCodes.Good);
                        results[3].targets.length.should.eql(1);
                        results[3].targets[0].targetId.toString().should.eql("ns=0;i=2261");
                        results[3].targets[0].targetId.value.should.eql(opcua.VariableIds.Server_ServerStatus_BuildInfo_ProductName);

                        // missing browseName on last element of the relativepath => ERROR
                        results[4].statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);

                        results[5].statusCode.should.eql(StatusCodes.BadNoMatch);

                        results[6].statusCode.should.eql(StatusCodes.BadNoMatch);

                    }
                    inner_done(err);
                });

            }, done);
        });

        it("TBP2 server should return BadNothingToDo when the translateBrowsePath browse path relativePath is empty", function (done) {

            /*
             CTT Test 5.7.3-Err-5
             Given an existent starting node and no RelativePath elements.
             When TranslateBrowsePathsToNodeIds is called server returns operation result Bad_NothingToDo.
             */

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
                var browsePath = new opcua.BrowsePath({
                    startingNode: opcua.resolveNodeId("ObjectsFolder"), ///ec.makeNodeId(opcua.ObjectIds.Server),
                    relativePath: { // RelativePath
                        elements: []
                    }
                });
                session.translateBrowsePath(browsePath, function (err, browsePathResult) {
                    should.not.exist(err);
                    browsePathResult._schema.name.should.equal("BrowsePathResult");
                    browsePathResult.statusCode.should.eql(StatusCodes.BadNothingToDo);
                    console.log(browsePathResult.toString())
                    browsePathResult.statusCode.should.eql(StatusCodes.BadNothingToDo);

                    inner_done();
                });
            }, done);
        });
    });
};
