"use strict";
require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog = opcua.utils.make_debugLog(__filename);


var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("testing basic Client-Server communication", function () {

    var server, client, temperatureVariableId, endpointUrl;


    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true,function() {
        before(function (done) {
            server = build_server_with_temperature_device({port: port}, function (err) {
                endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                temperatureVariableId = server.temperatureVariableId;
                done(err);
            });
        });

        beforeEach(function (done) {
            client = new OPCUAClient();
            done();
        });

        afterEach(function (done) {
            done();
        });

        after(function (done) {
            server.shutdown(function (err) {
                done(err);
            });
        });
    });

    it("T1 - a client should connect to a server and disconnect ", function (done) {

        server.currentChannelCount.should.equal(0);

        client.protocolVersion = 0;

        async.series([
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);

    });

    it("T2 - a server should not accept a connection when the protocol version is incompatible", function (done) {

        client.protocolVersion = 55555; // set a invalid protocol version
        server.currentChannelCount.should.equal(0);

        async.series([
            function (callback) {
                debugLog(" connect");
                client.connect(endpointUrl, function (err) {

                    debugLog(" Error =".yellow.bold, err);
                    callback(err);
                });
            }
        ], function (err) {
            server.currentChannelCount.should.equal(0);
            debugLog(" error : ", err);
            done();
        });

    });

    it("T3 - a client shall be able to create a session with a anonymous token", function (done) {

        server.currentChannelCount.should.equal(0);

        var g_session;
        async.series([
            function (callback) {
                debugLog(" connect");
                client.connect(endpointUrl, function (err) {
                    debugLog(" Error =".yellow.bold, err);
                    callback(err);
                });
            },
            function (callback) {
                debugLog(" createSession");
                client.createSession(function (err, session) {
                    g_session = session;
                    debugLog(" Error =".yellow.bold, err);
                    callback(err);
                });

            },
            function (callback) {
                debugLog("closing session");
                g_session.close(callback);
            },
            function (callback) {
                debugLog("Disconnecting client");
                client.disconnect(callback);
            },
            function (callback) {
                // relax a little bit so that server can complete pending operations
                setImmediate(callback);
            },
            function (callback) {
                // relax a little bit so that server can complete pending operations
                setImmediate(callback);
            }
        ], function (err) {

            debugLog("finally");
            server.currentChannelCount.should.equal(0);
            debugLog(" error : ", err);
            done();
        });

    });

    it("T4 - a client shall be able to reconnect if the first connection has failed", function (done) {

        server.currentChannelCount.should.equal(0);

        client.protocolVersion = 0;

        var unused_port = 8909;
        var bad_endpointUrl = "opc.tcp://localhost:" + unused_port;

        async.series([
            function (callback) {
                client.connect(bad_endpointUrl, function (err) {
                    err.message.should.match(/connect ECONNREFUSED/);
                    callback();
                });
            },
            function (callback) {
                client.connect(endpointUrl, function (err) {
                    assert(!err);
                    callback(err);
                });
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);

    });

    it("T5 - a client shall be able to connect & disconnect many times", function (done) {

        server.currentChannelCount.should.equal(0);

        function relax_for_a_little_while(callback) {
            setTimeout(callback, 20);
        }

        async.series([

            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                server.currentChannelCount.should.equal(1);
                callback();
            },
            function (callback) {
                client.disconnect(callback);
            },
            relax_for_a_little_while,
            function (callback) {
                server.currentChannelCount.should.equal(0);
                callback();
            },

            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                server.currentChannelCount.should.equal(1);
                callback();
            },
            function (callback) {
                client.disconnect(callback);
            },
            relax_for_a_little_while,
            function (callback) {
                server.currentChannelCount.should.equal(0);
                callback();
            },

            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                server.currentChannelCount.should.equal(1);
                callback();
            },
            function (callback) {
                client.disconnect(callback);
            },
            relax_for_a_little_while,
            function (callback) {
                server.currentChannelCount.should.equal(0);
                callback();
            },

        ], done);

    });

    it("T6 - a client shall raise an error when trying to create a session on an invalid endpoint", function (done) {

        // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
        //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
        //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
        //   Client  shall report the difference and may close the  SecureChannel.
        async.series([

            function (callback) {
                client.endpoint_must_exist = true;
                client.connect(endpointUrl + "/somecrap", callback);
            },

            function (callback) {
                client.createSession(function (err, session) {
                    assert(err);
                    assert(!session);
                    callback(err ? null : new Error("Expecting a failure"));
                });
            },

            function (callback) {
                client.disconnect(callback);
            }

        ], done);

    });

    it("T7 - calling connect on the client twice shall return a error the second time", function (done) {
        server.currentChannelCount.should.equal(0);

        client.protocolVersion = 0;

        async.series([
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {

                client.connect(endpointUrl, function (err) {

                    err.should.be.instanceOf(Error);

                    callback();
                });
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);
    });

    describe("Browse-Read-Write Services", function () {

        var g_session = null;

        beforeEach(function (done) {
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

        it("T8-1 - should browse RootFolder", function (done) {

            g_session.browse("RootFolder", function (err, browseResults) {
                if (!err) {
                    browseResults.length.should.equal(1);
                    browseResults[0]._schema.name.should.equal("BrowseResult");
                }
                done(err);
            });

        });

        it("T8-2 - browse should return BadReferenceTypeIdInvalid if referenceTypeId is invalid", function (done) {

            var bad_referenceid_node = "ns=3;i=3500";
            var browseDesc = {
                nodeId: "ObjectsFolder",
                referenceTypeId: bad_referenceid_node,
                browseDirection: BrowseDirection.Forward
            };
            g_session.browse(browseDesc, function (err, browseResults, diagnosticInfos) {
                browseResults.length.should.equal(1);
                browseResults[0]._schema.name.should.equal("BrowseResult");
                browseResults[0].statusCode.should.eql(StatusCodes.BadReferenceTypeIdInvalid);
                done(err);
            });
        });

        it("T8-3 should read a Variable", function (done) {

            g_session.readVariableValue(["RootFolder"], function (err, dataValues, diagnosticInfos) {
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

            g_session.performMessageTransaction(request, function (err, response) {
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

            g_session.performMessageTransaction(request, function (err, response) {
                //
                err.message.should.match(/BadTimestampsToReturnInvalid/);
                done();
            });

        });

        it("T8-13 should readAllAttributes", function (done) {

            g_session.readAllAttributes("RootFolder", function (err, nodesToRead, dataValues, diagnosticInfos) {
                nodesToRead.length.should.equal(dataValues.length);
                done(err);
            });
        });

        it("T8-14 #readVariableValue should return a appropriate status code if nodeid to read doesn't exists", function (done) {

            g_session.readVariableValue(["ns=1;s=this_node_id_does_not_exist"], function (err, dataValues, diagnosticInfos) {
                should(err).eql(null);
                dataValues[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                done();
            });
        });

        it("T8-15 #read should return BadNothingToDo when reading an empty nodeToRead array", function (done) {

            var nodesToRead = [];

            g_session.read(nodesToRead, function (err, unused, dataValues, diagnosticInfos) {
                if (err) {
                    var response = unused;
                    //dataValues.length.should.be(1);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
                    done();
                } else {
                    done(new Error("Expecting an error here"));
                }
            });
        });

        it("T8-15b #read :should return BadNothingToDo if nodesToRead is empty", function (done) {

            // CTT : Attribute ERR-011.js
            var readRequest = new opcua.read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
                nodesToRead: []
            });

            g_session.performMessageTransaction(readRequest,function(err,response){
                if(err) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                } else {
                    done(new Error("expecting BadNothingToDo"));
                }

            });

        });

        it("T8-15c #read :should return BadNothingToDo if nodesToRead is null", function (done) {

            // CTT : Attribute ERR-011.js
            var readRequest = new opcua.read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
                nodesToRead: null
            });

            // make sure nodesToRead is really null !
            readRequest.nodesToRead = null;

            g_session.performMessageTransaction(readRequest,function(err,response){
                if(err) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                } else {
                    done(new Error("expecting BadNothingToDo"));
                }

            });

        });

        it("T8-16 #read should return BadMaxAgeInvalid when Negative MaxAge parameter is specified", function (done) {

            var nodesToRead = [
                {
                    nodeId: "RootFolder",
                    attributeId: 13
                }
            ];
            g_session.read(nodesToRead, -20000, function (err, unused, dataValues, diagnosticInfos) {
                if (err) {
                    var response = unused;
                    //dataValues.length.should.be(1);
                    response.responseHeader.serviceResult.should.eql(StatusCodes.BadMaxAgeInvalid);
                    done();
                } else {
                    done(new Error("Expecting an error here"));
                }
            });
        });

        it("T8-17 #readVariableValue - should read the TemperatureTarget value", function (done) {

            g_session.readVariableValue([temperatureVariableId.nodeId], function (err, dataValues, diagnosticInfos) {

                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                    dataValues[0].value._schema.name.should.equal("Variant");
                }

                done(err);

            });
        });

        it("T8-20 #writeSingleNode -  should write the TemperatureTarget value", function (done) {

            var Variant = require("lib/datamodel/variant").Variant;
            var DataType = require("lib/datamodel/variant").DataType;
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


        describe("T9 - Accessing the Server object in the Root folder", function () {
            var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
            var ReferenceTypeIds = require("lib/opcua_node_ids").ReferenceTypeIds;
            var VariableIds = require("lib/opcua_node_ids").VariableIds;

            it("T9-1 - Server should expose a 'Server' object in the 'Objects' folder", function (done) {

                var Organizes = makeNodeId(ReferenceTypeIds.Organizes); // "ns=0;i=35";
                var browseDesc = {
                    nodeId: "ObjectsFolder",
                    referenceTypeId: Organizes,
                    browseDirection: BrowseDirection.Forward,
                    resultMask: 0x3F
                };

                g_session.browse(browseDesc, function (err, browseResults/*,diagnosticInfos*/) {
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
                var DataValue = require("lib/datamodel/datavalue").DataValue;
                var DataType = require("lib/datamodel/variant").DataType;
                var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
                var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
                var server_NamespaceArray_Id = makeNodeId(VariableIds.Server_NamespaceArray); // ns=0;i=2255
                g_session.readVariableValue(server_NamespaceArray_Id, function (err, dataValue, diagnosticsInfo) {
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
                g_session.readVariableValue(server_NamespaceArray_Id, function (err, dataValue, diagnosticsInfo) {
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
    });

})
;

describe("testing ability for client to reconnect when server close connection", function () {

    it("should be possible to reconnect client after the server closed the connection", function (done) {

        // todo:
        // start demo server
        // start client and create a session on server
        // shutdown server
        // verify that client has received a notification that connection has been closed
        // restart server
        // reuse the same client to reconnect to server
        // verify that client is connected
        // cleanup:
        //   - disconnect client
        //   - disconnect server
        //---------------------------------------------------------------


        var server = null;
        var endpointUrl = null;
        var temperatureVariableId = null;


        function start_demo_server(done) {
            server = build_server_with_temperature_device({port: port}, function (err) {
                endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                temperatureVariableId = server.temperatureVariableId;
                done(err);
            });
        }

        var client = null;
        var client_has_received_close_event;

        function create_client_and_create_a_connection_to_server(done) {
            client = new OPCUAClient();
            client.connect(endpointUrl, done);

            client_has_received_close_event = 0;
            client.on("close", function (err) {
                if (err) {
                    console.log("err=", err.message);
                }
                //xx console.log(" client has received close event");
                client_has_received_close_event += 1;
            });
        }

        function shutdown_server(done) {

            server.shutdown(function (err) {
                server = null;
                done(err);
            });
        }

        function wait_a_little_while(done) {
            setTimeout(done, 20);
        }

        function verify_that_client_has_received_close_event(done) {
            client_has_received_close_event.should.eql(1);
            done();
        }

        function restart_server(done) {
            start_demo_server(done);
        }

        function reuse_same_client_to_reconnect_to_server(done) {
            client.connect(endpointUrl, done);
        }

        function verify_that_client_is_connected(done) {
            // to do : do something useful here
            done();
        }

        function disconnect_client(done) {
            client.disconnect(done);
        }


        async.series([
            start_demo_server,
            create_client_and_create_a_connection_to_server,
            shutdown_server,
            wait_a_little_while,
            verify_that_client_has_received_close_event,
            restart_server,
            reuse_same_client_to_reconnect_to_server,
            verify_that_client_is_connected,
            disconnect_client,
            shutdown_server

        ], function (err) {
            done(err);
        });
    });

});

