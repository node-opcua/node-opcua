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
var makeNodeId = opcua.makeNodeId;
var ReferenceTypeIds = opcua.ReferenceTypeIds;
var VariableIds = opcua.VariableIds;

var context = require("lib/server/session_context").SessionContext.defaultContext;

var BrowseDirection = opcua.browse_service.BrowseDirection;
var debugLog = opcua.utils.make_debugLog(__filename);
var doDebug = process.env.DEBUG && process.env.DEBUG.match(/test/);

var port = 2000;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;

var fail_fast_connectivity_strategy = {
    maxRetry: 1,
    initialDelay: 10,
    maxDelay: 20,
    randomisationFactor: 0
};
var robust_connectivity_strategy = {
    maxRetry: 100,
    initialDelay: 10,
    maxDelay: 200,
    randomisationFactor: 0
};
var custom_connectivity_strategy = {
    maxRetry: 100,
    initialDelay: 80,
    maxDelay: 100,
    randomisationFactor: 0
};

var infinite_connectivity_strategy = {
    maxRetry: 1000000,
    initialDelay: 10,
    maxDelay:    200,
    randomisationFactor: 0
};


var step_count =0;
function f(func) {

    return function (callback) {
        if (doDebug) {     console.log("FUNC=>  ".bgWhite.cyan," " , step_count, func.name.yellow.bold); }
        func(function (err) {
            if (doDebug) { console.log("END =>  ".bgWhite.cyan," " , step_count, func.name.yellow.bold," => ", err ? err.name.red : "OK".green); }
            step_count++;
            callback(err);
        });
    }
}

describe("testing basic Client-Server communication", function () {

    var server, client, temperatureVariableId, endpointUrl;


    this.timeout(Math.max(20000,this._timeout));

    require("test/helpers/resource_leak_detector").installResourceLeakDetector(true, function () {

        before(function (done) {
            server = build_server_with_temperature_device({port: port}, function (err) {
                endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                temperatureVariableId = server.temperatureVariableId;
                done(err);
            });
        });

        beforeEach(function (done) {

            // use fail fast connectionStrategy
            var options = {connectionStrategy: fail_fast_connectivity_strategy};
            client = new OPCUAClient(options);
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
                server.currentChannelCount.should.equal(1);
                client.disconnect(callback);
            }

        ], function (err) {
            server.currentChannelCount.should.equal(0);
            done(err);
        });

    });

    it("T2 - a server should not accept a connection when the protocol version is incompatible", function (done) {

        client.protocolVersion = 0xDEADBEEF; // set a invalid protocol version
        server.currentChannelCount.should.equal(0);

        async.series([
            function (callback) {
                debugLog(" connect");

                client.connect(endpointUrl, function (err) {

                    debugLog(" Error =".yellow.bold, err);

                    callback(err ? null : new Error("Expecting an error here"));

                });
            }
        ], function (err) {
            server.currentChannelCount.should.equal(0);
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

        it("T8-3 - should read a Variable", function (done) {

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

        it("T8-13 - should readAllAttributes", function (done) {

            g_session.readAllAttributes("RootFolder", function (err, nodesToRead, dataValues, diagnosticInfos) {
                nodesToRead.length.should.equal(dataValues.length);
                done(err);
            });
        });

        it("T8-14 - #readVariableValue should return a appropriate status code if nodeid to read doesn't exists", function (done) {

            g_session.readVariableValue(["ns=1;s=this_node_id_does_not_exist"], function (err, dataValues, diagnosticInfos) {
                should(err).eql(null);
                dataValues[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);
                done();
            });
        });

        it("T8-15 - #read should return BadNothingToDo when reading an empty nodeToRead array", function (done) {

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

        it("T8-15b - #read :should return BadNothingToDo if nodesToRead is empty", function (done) {

            // CTT : Attribute ERR-011.js
            var readRequest = new opcua.read_service.ReadRequest({
                maxAge: 0,
                timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
                nodesToRead: []
            });

            g_session.performMessageTransaction(readRequest, function (err, response) {
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

            g_session.performMessageTransaction(readRequest, function (err, response) {
                if (err) {
                    err.message.should.match(/BadNothingToDo/);
                    done();
                } else {
                    done(new Error("expecting BadNothingToDo"));
                }

            });

        });

        it("T8-16 - #read should return BadMaxAgeInvalid when Negative MaxAge parameter is specified", function (done) {

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

        it("T8-17 - #readVariableValue - should read the TemperatureTarget value", function (done) {

            g_session.readVariableValue([temperatureVariableId.nodeId], function (err, dataValues, diagnosticInfos) {

                if (!err) {
                    dataValues.length.should.equal(1);
                    dataValues[0]._schema.name.should.equal("DataValue");
                    dataValues[0].value._schema.name.should.equal("Variant");
                }

                done(err);

            });
        });

        it("T8-20 - #writeSingleNode -  should write the TemperatureTarget value", function (done) {

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

describe("testing ability for client to reconnect when server close connection", function () {

    this.timeout(Math.max(60000, this._timeout));

    var server = null;
    var endpointUrl = null;
    var temperatureVariableId = null;

    var counterNode = null;
    var timerId;
    // -----------------------------------------------------------------------------------------------------------------
    // Common Steps
    // -----------------------------------------------------------------------------------------------------------------
    function start_demo_server(done) {

        server = build_server_with_temperature_device({port: port}, function (err) {

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;

            if (!err) {
                var c = 0;

                counterNode = server.engine.addressSpace.addVariable({
                    browseName: "Counter",
                    organizedBy: server.engine.addressSpace.rootFolder.objects,
                    dataType: "UInt32",
                    value: new Variant({dataType: opcua.DataType.UInt32, value: c})
                });
                timerId = setInterval(function () {
                    c = c + 1;
                    counterNode.setValueFromSource(new Variant({dataType: "UInt32", value: c}), StatusCodes.Good);
                }, 100);

            }
            done(err);
        });
    }

    function shutdown_server(done) {

        should(server).not.eql(null, "server not started ?");
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        server.shutdown(function (err) {
            server = null;
            done(err);
        });
    }

    function suspend_demo_server(callback) {
        server.suspendEndPoints(callback);
    }

    function resume_demo_server(callback) {
        server.resumeEndPoints(callback);
    }

    function restart_server(done) {
        should(server).eql(null, "server already started ?");
        start_demo_server(done);
    }

    function verify_that_server_has_no_active_channel(callback) {
        server.currentChannelCount.should.equal(0);
        callback();
    }

    function wait_for(duration, done) {
        assert(_.isFunction(done));
        setTimeout(function () {
            done();
        }, duration);
    }

    function wait_a_little_while(done) {
        assert(_.isFunction(done));
        wait_for(600, done);
    }


    var client = null;
    var client_has_received_close_event;
    var client_has_received_start_reconnection_event;

    var backoff_counter =  0;
    var requestedSessionTimeout = 10000;

    beforeEach(function() {
        requestedSessionTimeout = 10000;
    });

    function create_client_and_create_a_connection_to_server(connectivity_strategy, done) {

        done.should.be.instanceOf(Function);

        var options = {
            keepSessionAlive: true,
            requestedSessionTimeout: requestedSessionTimeout,
            connectionStrategy: connectivity_strategy
        };
        client = new OPCUAClient(options);

        client_has_received_close_event = 0;
        client_has_received_start_reconnection_event = 0;
        client.on("close", function (err) {
            if (err) {
                //xx console.log("err=", err.message);
            }
            client_has_received_close_event += 1;
        });

        client.on("start_reconnection", function (err) {
            client_has_received_start_reconnection_event += 1;
            debugLog("starting reconnection");
        });
        client.on("backoff", function (number,delay) {
            backoff_counter +=1;
        });
        client.connect(endpointUrl, function(err) {
            done(err);
        });
    }

    function reset_backoff_counter(done) {
        backoff_counter=0;
        done();
    }
    function assert_NO_backoff_event_since_last_reset(done) {
        backoff_counter.should.eql(0);
        done();
    }
    function assert_has_received_some_backoff_event_since_last_reset(done) {
        backoff_counter.should.be.greaterThan(0);
        done();
    }

    function verify_that_client_fails_to_connect(connectivity_strategy, done) {

        create_client_and_create_a_connection_to_server(connectivity_strategy, function (err) {
            done(err ? null : new Error("Expecting an error here"));
        })
    }

    function verify_that_client_has_received_a_single_start_reconnection_event(done) {
        try {
            client_has_received_start_reconnection_event.should.eql(1, "expecting 'start_reconnection' event to be emitted only once");
        }
        catch (err) {
            done(err);
        }
        done();
    }

    function verify_that_client_has_received_a_single_close_event(done) {
        try {
            client_has_received_close_event.should.eql(1, "expecting close event to be emitted only once");
        }
        catch (err) {
            done(err);
        }
        done();
    }

    function verify_that_client_is_connected(done) {
        // to do : do something useful here
        done();
    }

    function verify_that_client_is_trying_to_reconnect(done) {

        // wait a little bit and check that client has started the reconnection process
        setTimeout(function () {
            try {
                client.isReconnecting.should.eql(true, "verify_that_client_is_trying_to_reconnect");
            } catch (err) {
                done(err);
            }
            done();
        },10);
    }

    function verify_that_client_is_NOT_trying_to_reconnect(done) {
        setImmediate(function () {
            try {
                client.isReconnecting.should.eql(false, "verify_that_client_is_NOT_trying_to_reconnect");
            } catch (err) {
                done(err);
            }
            done();
        });
    }

    function wait_for_reconnection_to_be_completed(done) {
        client.once("after_reconnection", function (err) {
            done();
        });
    }

    function verify_that_client_has_NOT_received_a_close_event(done) {
        try {
            client_has_received_close_event.should.eql(0, "expecting close event NOT to be emitted");
        }
        catch (err) {
            done(err);
        }
        done();
    }

    function disconnect_client(done) {
        client.disconnect(done);
    }


    it("TR1 - should be possible to reconnect client after the server closed the connection", function (done) {

        // steps:
        //  -     Given a running demo server
        //  - and Given a client that has been configured  with a fail fast reconnection strategy
        //  - and Given that the client is  connected to the server
        //
        //  -     When the server shuts down
        //  - and When the reconnection time has been exhausted.
        //
        //  -     Then I should verify that client has received a "close" notification, only once
        //
        //  -     Given that the server has been restarted
        //  -     When  we reuse the same client to reconnect to server
        // -      Then I should verify that client can connect successfully
        // cleanup:
        //   - disconnect client
        //   - disconnect server
        //---------------------------------------------------------------


        function reuse_same_client_to_reconnect_to_server(done) {
            client.connect(endpointUrl, done);
        }

        async.series([
            f(start_demo_server),
            // use fail fast connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, fail_fast_connectivity_strategy)),
            f(shutdown_server),
            //f(wait_a_little_while),
            f(verify_that_client_is_trying_to_reconnect),
            f(wait_for_reconnection_to_be_completed),
            f(wait_a_little_while),
            f(verify_that_client_has_received_a_single_close_event),
            f(restart_server),
            f(reuse_same_client_to_reconnect_to_server),
            f(verify_that_client_is_connected),
            f(disconnect_client),
            f(verify_that_server_has_no_active_channel),
            f(shutdown_server)

        ], function (err) {
            done(err);
        });
    });

    it("TR2 - a client should be able to reconnect automatically to the server when the server restarts after a server failure", function (done) {

        // steps:
        //  -     Given a running demo server
        //  - and Given a client that has been configured  with a robust reconnection strategy
        //  - and Given that the client is  connected to the server
        //
        //  -     When the server shuts down
        //  - and When the server restarts after a little while
        //
        //  -     Then I should verify that client has *NOT* received a "close" notification
        //  -     and that the client can still communicate with server
        //
        // cleanup:
        //   - disconnect client
        //   - disconnect server

        async.series([
            f(start_demo_server),
            // use robust  connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, robust_connectivity_strategy)),
            f(shutdown_server),
            f(wait_a_little_while),
            f(verify_that_client_is_trying_to_reconnect),
            f(wait_a_little_while),
            f(verify_that_client_has_NOT_received_a_close_event),
            f(verify_that_client_is_trying_to_reconnect),
            f(verify_that_client_has_received_a_single_start_reconnection_event),
            f(restart_server),
            f(wait_a_little_while),
            f(wait_a_little_while),
            f(verify_that_client_is_connected),
            f(verify_that_client_is_NOT_trying_to_reconnect),
            f(verify_that_client_has_received_a_single_start_reconnection_event),
            f(disconnect_client),
            f(verify_that_server_has_no_active_channel),
            f(shutdown_server)
        ], function (err) {
            done(err);
        });
    });

    it("TR2a - a client should be able to reconnect automatically to the server when the server restarts after a server failure", function (done) {

        async.series([
            f(start_demo_server),
            // use robust  connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, robust_connectivity_strategy)),

            f(shutdown_server),
            f(wait_a_little_while),
            f(verify_that_client_is_trying_to_reconnect),
            f(wait_a_little_while),
            f(verify_that_client_has_NOT_received_a_close_event),
            f(verify_that_client_is_trying_to_reconnect),
            f(verify_that_client_has_received_a_single_start_reconnection_event),
            f(restart_server),
            f(wait_a_little_while),
            f(wait_a_little_while),
            f(verify_that_client_is_connected),
            f(verify_that_client_is_NOT_trying_to_reconnect),
            f(verify_that_client_has_received_a_single_start_reconnection_event),


            // reset client reconnection event counter
            function(callback) {client_has_received_start_reconnection_event = 0; callback(); },

            // Shutdown the server again
            f(shutdown_server),
            f(wait_a_little_while),
            f(verify_that_client_is_trying_to_reconnect),
            f(wait_a_little_while),
            f(verify_that_client_has_NOT_received_a_close_event),
            f(verify_that_client_is_trying_to_reconnect),
            f(verify_that_client_has_received_a_single_start_reconnection_event),
            f(restart_server),
            f(wait_a_little_while),
            f(wait_a_little_while),
            f(verify_that_client_is_connected),
            f(verify_that_client_is_NOT_trying_to_reconnect),
            f(verify_that_client_has_received_a_single_start_reconnection_event),



            f(disconnect_client),
            f(verify_that_server_has_no_active_channel),
            f(shutdown_server)
        ], function (err) {
            done(err);
        });
    });

    it("TR3 - it should be possible to disconnect a client which is in the middle a reconnection sequence", function (done) {
        async.series([
            f(start_demo_server),
            // use robust connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, robust_connectivity_strategy)),
            f(shutdown_server),
            f(wait_a_little_while),
            f(verify_that_client_is_trying_to_reconnect),
            f(wait_a_little_while),
            f(disconnect_client),
            f(wait_a_little_while),
            f(verify_that_client_is_NOT_trying_to_reconnect),
            f(wait_a_little_while),
            f(verify_that_client_is_NOT_trying_to_reconnect),

        ], function (err) {
            done(err);
        });


    });


    var the_session = null;

    function client_create_and_activate_session(callback) {
        client.createSession(function (err, session) {
            if (!err) {
                the_session = session;
                ///xx console.log("session timeout = ",the_session.timeout," ms");
            }
            callback(err);
        });
    }

    var subscription = null;

    function create_subscription(callback) {

        subscription = new opcua.ClientSubscription(the_session, {
            requestedPublishingInterval: 500,
            requestedLifetimeCount: 120,
            requestedMaxKeepAliveCount: 150,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 6
        });
        subscription.once("started", function () {
            callback();
        });
    }

    function terminate_subscription(callback) {

        //xx console.log(" subscription.publish_engine.subscriptionCount", subscription.publish_engine.subscriptionCount);
        subscription.on("terminated", function () {
            //xx console.log(" subscription.publish_engine.subscriptionCount", subscription.publish_engine.subscriptionCount);
            callback();
        });
        subscription.terminate();

    }

    var values_to_check = [];

    function monitor_monotonous_counter(callback) {

        var monitoredItem = subscription.monitor(
            {
                // nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                nodeId: counterNode.nodeId,
                attributeId: opcua.AttributeIds.Value
            },
            {
                samplingInterval: 0, // 0 : event base => whenever value changes
                discardOldest: true,
                queueSize: 1000
            });


        // subscription.on("item_added",function(monitoredItem){
        monitoredItem.on("initialized", function () {
            //xx console.log("monitoredItem.monitoringParameters.samplingInterval",monitoredItem.monitoringParameters.samplingInterval);//);
            callback();
        });

        monitoredItem.on("changed", function (dataValue) {
            //xx console.log(" client ", " received value change ", dataValue.value.toString());
            values_to_check.push(dataValue.value.value);
        });
    }

    var previous_value_count =0;
    function reset_continuous(callback) {
        //xx console.log(" resetting value to check");
        values_to_check = [];
        previous_value_count = 0;
        callback();
    }

    function ensure_continuous(callback) {
        // ensure we have more value than previous call
        // ensure that series is continuous
        if (doDebug) {
            //xx console.log(values_to_check.join(" "));
        }

        values_to_check.length.should.be.greaterThan(previous_value_count+1," expecting new values");
        if (values_to_check.length > 0) {
            values_to_check[values_to_check.length - 1].should.eql(values_to_check[0] + values_to_check.length - 1);
        }
        previous_value_count = values_to_check.length;
        callback();
    }

    function break_connection(socketError, callback) {
        var socket = client._secureChannel._transport._socket;
        socket.end();
        socket.destroy();
        socket.emit('error', new Error(socketError));
        callback();
    }

    function simulate_connection_break(breakage_duration, socketError, callback) {

        async.series([
            suspend_demo_server,

            break_connection.bind(null, socketError),

            wait_for.bind(null, breakage_duration),

            resume_demo_server
        ], callback);

    }

    function get_server_side_subscription() {
        var channels = server.endpoints[0]._channels;
        //xx console.log("channels keys = ", Object.keys(channels).join(" "));

        var channelKey = Object.keys(channels)[0];
        var channel = channels[channelKey];

        assert(Object.keys(server.engine._sessions).length === 1);
        var sessionKey = Object.keys(server.engine._sessions)[0];
        var session = server.engine._sessions[sessionKey];

        var subscriptionKeys = Object.keys(session.publishEngine._subscriptions);
        assert(subscriptionKeys.length === 1);
        return session.publishEngine._subscriptions[subscriptionKeys[0]];
    }

    function wait_until_server_subscription_has_timed_out(callback) {

        var server_subscription = get_server_side_subscription();

        // let's cheat a little bit => we don't really want to wait until subscriptions times out
        // let make sure it will timeout almost immediataly
        function accelerate_subscription_timeout(subscription, callback) {
            //xx console.log("accelerate_subscription_timeout", subscription.id, " =>  _life_time_counter = ", subscription._life_time_counter, subscription.lifeTimeCount);
            subscription._life_time_counter = subscription.lifeTimeCount - 1;

            subscription.once("terminated", function () {
                callback();
            });
        }

        accelerate_subscription_timeout(server_subscription, callback);
    }

    function simulate_very_long_connection_break_until_subscription_times_out(socketError, callback) {

        async.series([
            suspend_demo_server,

            break_connection.bind(null, socketError),

            wait_until_server_subscription_has_timed_out,

            wait_for.bind(null, 200),

            resume_demo_server
        ], callback);
        // in this case, the server drops all Subscriptions due to max lifetime count exhausted.
    }


    it("TR4 - verify that server can suspend socket connection - useful for testing purposes", function (done) {


        async.series([
            f(start_demo_server),
            f(create_client_and_create_a_connection_to_server.bind(null, robust_connectivity_strategy)),
            f(disconnect_client),

            f(suspend_demo_server),

            // verify that client cannot connect anymore
            f(verify_that_client_fails_to_connect.bind(null, fail_fast_connectivity_strategy)),

            f(resume_demo_server),

            // verify that client can connect again
            f(create_client_and_create_a_connection_to_server.bind(null, robust_connectivity_strategy)),
            f(disconnect_client),

            f(shutdown_server)
        ], function (err) {
            done(err);
        });

    });

    it("TR5 -a client with some active monitoring items should be able to seamlessly reconnect after a connection break - and retrieve missed notification without lost ( Republish)", function (done) {

        async.series([
            f(start_demo_server),
            f(reset_continuous),
            // use robust connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, custom_connectivity_strategy)),
            f(client_create_and_activate_session),
            f(create_subscription),
            f(monitor_monotonous_counter),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),

            // now drop connection  for 1.5 seconds
            f(simulate_connection_break.bind(null, 1500, 'ECONNRESET')),
            // make sure that we have received all notifications
            // (thanks to republish )

            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(wait_a_little_while),
            f(ensure_continuous),

            f(terminate_subscription),

            f(disconnect_client),
            f(shutdown_server)
        ], function (err) {
            done(err);
        });

    });

    it("TR6 -  a client with some active monitoring items should be able to seamlessly reconnect after a very long connection break exceeding subscription lifetime", function (done) {

        // a client with some active monitoring items should be able to seamlessly reconnect
        // after a very long connection break exceeding subscription lifetime.
        // In this case, the subscription on the server side has been deleted, therefore the client shall
        // recreate the subscription and resubscribe to the monitored items

        async.series([
            f(start_demo_server),
            f(reset_continuous),
            // use robust connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, custom_connectivity_strategy)),
            f(client_create_and_activate_session),
            f(create_subscription),
            f(monitor_monotonous_counter),

            f(wait_a_little_while),
            f(ensure_continuous),

            f(wait_a_little_while),
            f(ensure_continuous),


            // now drop connection  for a long time, so that server
            // has to delete all pending subscriptions....
            f(simulate_very_long_connection_break_until_subscription_times_out.bind(null, 'ECONNRESET')),


            f(reset_continuous),
            f(wait_a_little_while),
            f(wait_a_little_while),
            f(wait_a_little_while),
            f(ensure_continuous),

            f(wait_a_little_while),
            f(ensure_continuous),

            f(wait_a_little_while),
            f(ensure_continuous),

            f(terminate_subscription),

            f(disconnect_client),
            f(shutdown_server)
        ], function (err) {
            done(err);
        });
    });

    xit("TR7 -  a client with some active monitored items should be able to reconnect seamlessly after a very long connection break exceeding session life time", function (done) {
        // to do
        async.series([

        ],done);
    });

    it("TR8 -  disconnecting during connect", function(done) {
        // Given a client that has a infinite connection retry strategy,
        //   And that client#connect is call to connect to an non-existent server.
        //
        //  When client#disconnect is called
        //
        //  Then the client should complete the client#connect async call with and err;
        //   And the client should stop the automatic reconnection strategy (backoff)
        // to do


        // Given a client that has a infinite connection retry strategy,
        //   And that client#connect is call to connect to an non-existent server.
        //
        var client = null;
        var client_has_received_close_event = 0;
        var client_has_received_start_reconnection_event;

        var options = {connectionStrategy: infinite_connectivity_strategy};
        client = new OPCUAClient(options);

        client.on("close", function (err) {
            if (err) {
                console.log("err=", err.message);
            }
            client_has_received_close_event += 1;
        });

        client.on("start_reconnection", function (err) {
            client_has_received_start_reconnection_event += 1;
        });

        var backoff_event_counter =0;
        client.on("backoff", function (err) {
            backoff_event_counter+=1;
        });

        endpointUrl = "opc.tcp://somewhere-far-away.in.an.other.galaxy.com:4242";

        // let's call connect.
        // because the endpointUrl doesn't exist,  and the the infinite_connectivity_strategy
        // the client with indefinitely try to connect, causing the callback function
        // passed to the client#connect method not to be called.
        var connect_done = false;
        var connect_err = null;
        client.connect(endpointUrl, function(err) {
            connect_err = err;
            //xx console.log("client.connect(err) err = ",err);
            connect_done = true;
        });

        var count_ref = 0;

        async.series([

            // Wait until backoff is raised several times
            function(callback) {
                client.once("backoff", function(number,delay) { callback(); });
            },
            function(callback) {
                client.once("backoff", function(number,delay) { callback(); });
            },
            function(callback) {
                client.once("backoff", function(number,delay) { callback(); });
            },
            function(callback) {

                backoff_event_counter.should.be.greaterThan(2);
                // client should be still trying to connect
                connect_done.should.eql(false);

                //  When client#disconnect is called
                client_has_received_close_event.should.eql(0);

                client.disconnect(function(err) {

                    client_has_received_close_event.should.eql(1);
                    // connect callback should have been called...
                    connect_done.should.eql(true);

                    callback(err);
                    count_ref = backoff_event_counter;

                });
            },
            f(wait_a_little_while),
            function(callback) {
                client_has_received_close_event.should.eql(1);
                // backoff must be terminated now
                count_ref.should.eql(backoff_event_counter);
                callback(null);
            }
         ],done);

    });

    it("TR9 -  disconnecting during reconnect", function(done) {
        // Given a client that has a infinite connection retry strategy,
        //   And the client has a lived connection with a server
        //   And that the connection has dropped ( backoff stragety taking place)
        //
        //  When client#disconnect is called
        //
        //   Then the client should stop the  automatic reconnection strategy (backoff)

        client_has_received_close_event
        async.series([

            f(start_demo_server),

            f(create_client_and_create_a_connection_to_server.bind(null, infinite_connectivity_strategy)),
            f(wait_a_little_while),
            f(shutdown_server),
            f(reset_backoff_counter),
            f(wait_for.bind(null,2000)),
            f(verify_that_client_is_trying_to_reconnect),
            f(verify_that_client_has_NOT_received_a_close_event),
            f(verify_that_client_has_received_a_single_start_reconnection_event),
            f(assert_has_received_some_backoff_event_since_last_reset),

            f(wait_for.bind(null,2000)),
            f(disconnect_client),

            f(reset_backoff_counter),
            f(wait_for.bind(null,5000)),

            f(assert_NO_backoff_event_since_last_reset),
            f(verify_that_client_is_NOT_trying_to_reconnect)

        ],done);

    });
    it("TR10 -  a client should notify that the reconnection attempt is taking place with an event", function(done) {
        // Given a client and a server with an established connection
        // When the connection link dropped
        // Then the client shall raise an event to indicate that the reconnection process is now taking place.
        async.series([

            f(start_demo_server),

            f(create_client_and_create_a_connection_to_server.bind(null, infinite_connectivity_strategy)),
            f(wait_a_little_while),
            f(shutdown_server),
            f(wait_a_little_while),
            f(verify_that_client_has_received_a_single_start_reconnection_event),

            f(reset_backoff_counter),
            f(wait_for.bind(null,2000)),
            f(assert_has_received_some_backoff_event_since_last_reset),

            f(reset_backoff_counter),
            f(wait_for.bind(null,2000)),
            f(assert_has_received_some_backoff_event_since_last_reset),

            f(disconnect_client),

        ],done);
    });

    it("TR11 -  a client with active monitoring should be able to reconnect after a EPIPE connection break cause local socket end has been shut down", function (done) {
        async.series([
            f(start_demo_server),
            f(reset_continuous),
            // use robust connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, custom_connectivity_strategy)),
            f(client_create_and_activate_session),
            f(create_subscription),
            f(monitor_monotonous_counter),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),

            // now drop connection  for 1.5 seconds
            f(simulate_connection_break.bind(null, 1500, 'EPIPE')),
            // make sure that we have received all notifications
            // (thanks to republish )

            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),

            f(terminate_subscription),

            f(disconnect_client),
            f(shutdown_server)
        ], function (err) {
            done(err);
        });

    });


    it("TR12 -  a client with active monitored item should be able to reconnect and transfer subscriptions when session timeout", function (done) {

        requestedSessionTimeout = 1000;

        async.series([
            f(start_demo_server),
            f(reset_continuous),
            // use robust connectionStrategy
            f(create_client_and_create_a_connection_to_server.bind(null, custom_connectivity_strategy)),
            f(client_create_and_activate_session),
            f(create_subscription),
            f(monitor_monotonous_counter),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),

            // now drop connection  for 3 times requestedSessionTimeout seconds
            f(simulate_connection_break.bind(null, 3*requestedSessionTimeout, 'EPIPE')),
            // make sure that we have received all notifications
            // (thanks to republish )

            f(wait_a_little_while),
            f(wait_a_little_while),
            f(ensure_continuous),
            f(wait_a_little_while),
            f(ensure_continuous),

            f(terminate_subscription),

            f(disconnect_client),
            f(shutdown_server)
        ], function (err) {
            if (server) {
                server.engine.currentSessionCount.should.eql(0);
            }
            done(err);
        });

    });

});
