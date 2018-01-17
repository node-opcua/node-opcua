"use strict";
/* global require, process, __filename, it, before, beforeEach, after, afterEach */
var should = require("should");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");


var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var makeNodeId = opcua.makeNodeId;
var ReferenceTypeIds = opcua.ReferenceTypeIds;
var VariableIds = opcua.VariableIds;
var VariantArrayType = opcua.VariantArrayType;

var BrowseDirection = opcua.BrowseDirection;

var fail_fast_connectivity_strategy = {
    maxRetry: 1,
    initialDelay: 10,
    maxDelay: 20,
    randomisationFactor: 0
};


module.exports = function (test) {

    describe("Browse-Read-Write Services", function () {

        var g_session = null;

         // use fail fast connectionStrategy
        var options = {connectionStrategy: fail_fast_connectivity_strategy};

        var client;
        var endpointUrl;
        var temperatureVariableId;
        beforeEach(function (done) {
             endpointUrl = test.endpointUrl;
            temperatureVariableId = test.server.temperatureVariableId;
            client = new opcua.OPCUAClient(options);

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
            if (!g_session) {
                return client.disconnect(done);
            }
            g_session.close(function () {

                client.disconnect(done);

            });

        });

        it("T8-1 - should browse RootFolder", function (done) {

            g_session.browse("RootFolder", function (err, browseResult) {
                if (!err) {
                    browseResult._schema.name.should.equal("BrowseResult");
                }
                done(err);
            });

        });

        it("T8-2 - browse should return BadReferenceTypeIdInvalid if referenceTypeId is invalid", function (done) {

            var bad_referenceid_node = "ns=3;i=3500";
            var nodeToBrowse = {
                nodeId: "ObjectsFolder",
                referenceTypeId: bad_referenceid_node,
                browseDirection: BrowseDirection.Forward
            };
            g_session.browse(nodeToBrowse, function (err, browseResult/*, diagnosticInfos*/) {
                browseResult._schema.name.should.equal("BrowseResult");
                browseResult.statusCode.should.eql(StatusCodes.BadReferenceTypeIdInvalid);
                done(err);
            });
        });

        it("T8-3 - should read a Variable", function (done) {

            g_session.readVariableValue(["RootFolder"], function (err, dataValues/*, diagnosticInfos*/) {
                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                }
                done(err);
            });
        });

        it("T8-11 - #ReadRequest : server should return BadNothingToDo when nodesToRead is empty", function (done) {

            var request = new opcua.read_service.ReadRequest({
                nodesToRead: [], //<< EMPTY
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Both
            });

            g_session.performMessageTransaction(request, function (err /*, response */) {
                //
                err.message.should.match(/BadNothingToDo/);
                done();
            });

        });

        it("T8-12 - #ReadRequest : server should return BadTimestampsToReturnInvalid when timestampsToReturn is Invalid", function (done) {

            var request = new opcua.read_service.ReadRequest({
                nodesToRead: [
                    {nodeId: opcua.coerceNodeId("ns=0;i=2456")}
                ],
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Invalid
            });

            g_session.performMessageTransaction(request, function (err/*, response*/) {
                //
                err.message.should.match(/BadTimestampsToReturnInvalid/);
                done();
            });

        });

        it("T8-13 - should readAllAttributes - 1 element", function (done) {

            g_session.readAllAttributes("RootFolder", function (err, data) {
                should.not.exist(err);
                data.nodeId.toString().should.eql("ns=0;i=84");
                data.statusCode.should.eql(StatusCodes.Good);
                data.browseName.toString().should.eql("Root");
                done(err);
            });
        });

        it("T8-13b - should readAllAttributes - 2 elements", function (done) {

            g_session.readAllAttributes([ "RootFolder", "ObjectsFolder"], function (err, data) {
                data.length.should.eql(2);
                data[0].browseName.toString().should.eql("Root");
                data[1].browseName.toString().should.eql("Objects");
                done(err);
            });
        });

        it("T8-14a - #readVariableValue should return a appropriate status code if nodeid to read doesn't exists", function (done) {

            g_session.readVariableValue("ns=1;s=this_node_id_does_not_exist", function (err, dataValue) {
                should(err).eql(null);
                dataValue.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                done();
            });
        });
        it("T8-14b - #readVariableValue should return a appropriate status code if nodeid to read doesn't exists", function (done) {

            g_session.readVariableValue(["ns=1;s=this_node_id_does_not_exist"], function (err, dataValues) {
                should(err).eql(null);
                dataValues[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                done();
            });
        });
        it("T8-15 - #read should return BadNothingToDo when reading an empty nodeToRead array", function (done) {

            var nodesToRead = [];

            g_session.read(nodesToRead, function (err, dataValues) {
                if (err) {
                    var response = dataValues;
                    //dataValues.length.should.be(1);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                    done();
                } else {
                    done(new Error("Expecting an error here"));
                }
            });
        });

        it("T8-15b - #read :should return BadNothingToDo if nodesToRead is empty", function (done) {

            // CTT : Attribute ERR-011.js
            var readRequest = new opcua.read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
                nodesToRead: []
            });

            g_session.performMessageTransaction(readRequest, function (err/*, response*/) {
                if (err) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                } else {
                    done(new Error("expecting BadNothingToDo"));
                }

            });

        });

        it("T8-15c - #read :should return BadNothingToDo if nodesToRead is null", function (done) {

            // CTT : Attribute ERR-011.js
            var readRequest = new opcua.read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
                nodesToRead: null
            });

            // make sure nodesToRead is really null !
            readRequest.nodesToRead = null;

            g_session.performMessageTransaction(readRequest, function (err/*, response*/) {
                if (err) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                } else {
                    done(new Error("expecting BadNothingToDo"));
                }

            });

        });

        it("T8-16 - #read should return BadMaxAgeInvalid when Negative MaxAge parameter is specified", function (done) {

            var nodesToRead = {
                    nodeId: "RootFolder",
                    attributeId: 13
            };

            g_session.read(nodesToRead, -20000, function (err,  dataValue) {
                if (err) {
                    //Xx console.log(err);
                    err.message.should.match(/BadMaxAgeInvalid/);
                    done();
                } else {
                    done(new Error("Expecting an error here"));
                }
            });
        });

        it("T8-17 - #readVariableValue - should read the TemperatureTarget value", function (done) {

            g_session.readVariableValue([temperatureVariableId.nodeId], function (err, dataValues/*, diagnosticInfos*/) {

                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                    dataValues[0].value._schema.name.should.equal("Variant");
                }

                done(err);

            });
        });

        it("T8-20 - #writeSingleNode -  should write the TemperatureTarget value", function (done) {

            // write a single value
            g_session.writeSingleNode(
                temperatureVariableId.nodeId,
                {dataType: DataType.Double, value: 37.5},
                function (err, statusCode/*,diagnosticInfo*/) {
                    if (!err) {
                        statusCode.should.eql(StatusCodes.Good);
                    }
                    done(err);
                });
        });

        it("T9-1 - Server should expose a 'Server' object in the 'Objects' folder", function (done) {

            var Organizes = makeNodeId(ReferenceTypeIds.Organizes); // "ns=0;i=35";
            var nodesToBrowse = [{
                nodeId: "ObjectsFolder",
                referenceTypeId: Organizes,
                browseDirection: BrowseDirection.Forward,
                resultMask: 0x3F
            }];

            g_session.browse(nodesToBrowse, function (err, browseResults/*,diagnosticInfos*/) {
                if (!err) {
                    browseResults.length.should.equal(1);
                    browseResults[0]._schema.name.should.equal("BrowseResult");

                    //xx console.log(util.inspect(browseResults[0].references,{colors:true,depth:10}));

                    var foundNode = _.filter(browseResults[0].references, function (result) {
                        return result.browseName.name === "Server";
                    });
                    foundNode.length.should.equal(1);
                    foundNode[0].browseName.name.should.equal("Server");
                    foundNode[0].nodeId.toString().should.equal("ns=0;i=2253");
                }
                done(err);
            });
        });

        it("T9-2 - Server should expose 'Server_NamespaceArray' variable ", function (done) {

            var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
            g_session.readVariableValue(server_NamespaceArray_Id, function (err, dataValue/*, diagnosticsInfo*/) {
                if (err) {
                    return done(err);
                }
                dataValue.should.be.instanceOf(DataValue);
                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.dataType.should.eql(DataType.String);
                dataValue.value.arrayType.should.eql(VariantArrayType.Array);

                // first namespace must be standard OPC namespace
                dataValue.value.value[0].should.eql("http://opcfoundation.org/UA/");

                done(err);
            });

        });

        it("T9-3 - ServerStatus object shall be accessible as a ExtensionObject", function (done) {

            var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_ServerStatus); // ns=0;i=2255
            g_session.readVariableValue(server_NamespaceArray_Id, function (err, dataValue/*, diagnosticsInfo*/) {
                if (err) {
                    return done(err);
                }
                dataValue.should.be.instanceOf(DataValue);
                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);

                done(err);
            });

        });

    });
};

