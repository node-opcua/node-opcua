/*global describe, it, require*/
require("requirish")._(module);
var OPCUAClient = require("lib/client/opcua_client").OPCUAClient;
//var ClientSession = require("lib/client/opcua_client").ClientSession;
//var ClientSubscription = require("lib/client/client_subscription").ClientSubscription;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;

var perform_operation_on_client_session = require("./helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("./helpers/perform_operation_on_client_session").perform_operation_on_subscription;

var opcua = require("index");
var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;


describe("testing CALL SERVICE on a fake server exposing the temperature device", function () {

    var server, client, temperatureVariableId, endpointUrl;

    this.timeout(2000);

    var port = 2000;
    before(function (done) {
        port = port +1;
        server = build_server_with_temperature_device({port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });


    it("Q1 should retrieve the inputArgument of a method using a OPCUA transaction getArgumentDefinition",function(done){

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            var objectId= coerceNodeId("ns=0;i=2253");// server
            var methodId= coerceNodeId("ns=0;i=11492"); // GetMonitoredItem
            session.getArgumentDefinition(methodId,function(err,inputArguments,outputArguments){
                //xx console.log("inputArguments  ",inputArguments);
                //xx console.log("outputArguments ",outputArguments);
                inputArguments.length.should.equal(1);
                outputArguments.length.should.equal(2);
                inner_done(err);
            })
        },done);

    });

    it("Q2 should return BadNothingToDo when CallRequest has no method to call", function (done) {

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call([],function(err){

                should(err).not.equal(null);
                err.should.be.instanceOf(Error);
                err.message.should.match(/BadNothingToDo/);

                inner_done();
            });
        },done);

    });


    it("Q3 should return BadTooManyOperations when CallRequest has too many methods to call", function (done) {

        var too_many = 1000;
        var methodToCalls = [];
        for (var i=0;i < too_many;i++ ) { methodToCalls.push({
            objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
            methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
            inputArguments: [{ dataType: DataType.UInt32,value: [1] }]
        });}

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){

                should(err).not.equal(null);
                err.should.be.instanceOf(Error);
                err.message.should.match(/BadTooManyOperations/);

                should(results).not.eql(null);
                inner_done();
            });

        },done);

    });

    it("Q4 should succeed and return BadNodeIdInvalid when CallRequest try to address an node that is not an UAObject", function (done) {


        var methodToCalls = [{
            objectId: coerceNodeId("ns=0;i=864"), //  Default Binary doesn't have methods
            methodId: coerceNodeId("ns=0;i=11489"),
            inputArguments: [{ dataType: DataType.UInt32,value: [1] }]
        }];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){
                should(err).equal(null);
                results.length.should.eql(1);

                results[0].statusCode.should.eql(StatusCodes.BadNodeIdInvalid);

                inner_done();
            });
        },done);

    });

    it("Q5 should succeed and return BadNodeIdUnknown when CallRequest try to address an unknwon object", function (done) {

        var methodToCalls = [{
            objectId: coerceNodeId("ns=0;s=UnknownObject"),
            methodId: coerceNodeId("ns=0;s=UnknownMethod")
        }];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){
                should(err).equal(null);
                results.length.should.eql(1);

                results[0].statusCode.should.eql(StatusCodes.BadNodeIdUnknown);

                inner_done();
            });
        },done);

    });

    it("Q6 should succeed and return BadMethodInvalid when CallRequest try to address an unknwon method on a valid object", function (done) {

        var methodToCalls = [{
            objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
            methodId: coerceNodeId("ns=0;s=unknown_method")
           // methodId: coerceNodeId("ns=0;s=11489")
        }];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){
                should(err).equal(null);
                results.length.should.eql(1);

                results[0].statusCode.should.eql(StatusCodes.BadMethodInvalid);

                inner_done();
            });
        },done);

    });

    it("Q7 should succeed and return BadInvalidArgument when CallRequest has invalid arguments", function (done) {

        var methodToCalls = [{
            objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
            methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
            inputArguments: [] // invalid => missing arg !
        }];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){

                should(err).equal(null);
                results.length.should.eql(1);

                results[0].statusCode.should.eql(StatusCodes.BadInvalidArgument);

                inner_done();
            });
        },done);

    });
    it("Q8 should succeed and return BadTypeMismatch when CallRequest is GetMonitoredItem and has the argument with a wrong dataType ", function (done) {

        var methodToCalls = [{
            objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
            methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem
            inputArguments: [
                { dataType: DataType.QualifiedName } // intentionally a wrong dataType here
            ]
        }];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){

                should(err).equal(null);
                results.length.should.eql(1);
                results[0].statusCode.should.eql(StatusCodes.BadTypeMismatch);

                results[0].inputArgumentResults.should.be.instanceOf(Array);
                results[0].inputArgumentResults.length.should.eql(1);
                results[0].inputArgumentResults[0].should.eql(StatusCodes.BadTypeMismatch);

                inner_done();
            });
        },done);

    });


    it("Q9 should succeed and return BadSubscriptionId when CallRequest is GetMonitoredItem and has valid arguments but invalid subscriptionId ", function (done) {

        opcua.MethodIds.Server_GetMonitoredItems.should.eql(11492);

        var subscriptionId = 100;
        var methodToCalls = [{
            objectId: coerceNodeId("ns=0;i=2253"),  // SERVER
            methodId: coerceNodeId("ns=0;i=11492"), // GetMonitoredItem


            inputArguments: [
                // subscriptionID( UInt32)
               { dataType: DataType.UInt32, value: subscriptionId }
            ]
        }];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            session.call(methodToCalls,function(err,results){
                if (!err) {
                    results.length.should.eql(1);
                    results[0].statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);
                }

                inner_done(err);
            });
        },done);

    });

    describe("GetMonitoredItems",function() {

        it("T1 A client should be able to call the GetMonitoredItems standard OPCUA command, and return BadSubscriptionId if input args subscriptionId is invalid ",function(done){

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var subscriptionId = 1000000 ; // invalid subscription ID

                session.getMonitoredItems(subscriptionId,function(err,monitoredItems){

                    should(err).not.eql(null);
                    err.message.should.match(/BadSubscriptionId/);
                    inner_done();
                });
            },done);

        });


        it("T2 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and no monitored Item",function(done){

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                var subscriptionId = subscription.subscriptionId ;

                session.getMonitoredItems(subscriptionId,function(err,result){
                    if (!err) {
                        should(result.serverHandles).be.instanceOf(Array);
                        should(result.clientHandles).be.instanceOf(Array);
                        result.serverHandles.length.should.eql(0);
                        result.clientHandles.length.should.eql(0);
                    }
                    inner_done(err);
                });
            },done);

        });



        it("T3 A client should be able to call the GetMonitoredItems standard OPCUA command, with a valid subscriptionId and one monitored Item",function(done){

            perform_operation_on_subscription(client, endpointUrl, function (session, subscription, inner_done) {

                var subscriptionId = subscription.subscriptionId ;

                var monitoredItem = subscription.monitor(
                    {nodeId: resolveNodeId("ns=0;i=2258"), attributeId: AttributeIds.Value},
                    {samplingInterval: 10, discardOldest: true, queueSize: 1 });

                // subscription.on("item_added",function(monitoredItem){
                monitoredItem.on("initialized", function () {

                });
                monitoredItem.on("changed", function (value) {

                    session.getMonitoredItems(subscriptionId,function(err,result){

                        if (!err) {
                            should(result.serverHandles).be.instanceOf(Array);
                            should(result.clientHandles).be.instanceOf(Array);
                            result.serverHandles.length.should.eql(1);
                            result.clientHandles.length.should.eql(1);
                        }
                        //xx console.log("serverHandles = ",result.serverHandles);
                        //xx console.log("clientHandles = ",result.clientHandles);
                        inner_done(err);
                    });

                    // lets stop monitoring this item
                    monitoredItem.terminate(function () {
                    });
                });


            },done);

        });
        it("T4 GetMonitoredItem must have the Executable attribute set",function(done) {

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                var nodesToRead = [
                    {
                        nodeId: "ns=0;i=11492",
                        attributeId: AttributeIds.Executable
                    },
                    {
                        nodeId: "ns=0;i=11492",
                        attributeId: AttributeIds.UserExecutable
                    }
                ];

                session.read(nodesToRead, function(err,unused,dataValues,diagnosticInfos) {
                    if (!err) {
                        dataValues[0].statusCode.should.eql(StatusCodes.Good);
                        dataValues[0].value.dataType.should.eql(DataType.Boolean);
                        dataValues[0].value.value.should.eql(true);
                        dataValues[1].statusCode.should.eql(StatusCodes.Good);
                        dataValues[1].value.dataType.should.eql(DataType.Boolean);
                        dataValues[1].value.value.should.eql(true);
                    }
                    inner_done(err);
                })

            },done);
        });
    });

    it("should find the OutputArguments and InputArguments Properties with a translate browse path reaquest ( like UAEpxert)",function(done) {

        // note : this is how UAExpert tries to figure out what are the input and output arguments definition
        //
        var getMonitoredItemMethodId =  coerceNodeId("ns=0;i=11492");

        var hasPropertyRefId = resolveNodeId("HasProperty");/* NodeId  ns=0;i=46*/
        var browsePath = [{
                    startingNode: /* NodeId  */ getMonitoredItemMethodId,
                    relativePath: /* RelativePath   */  {
                        elements: /* RelativePathElement */ [
                            {
                                referenceTypeId: hasPropertyRefId,
                                isInverse: false,
                                includeSubtypes: false,
                                targetName: { namespaceIndex: 0, name: "InputArguments" }
                            }
                        ]
                    }
                }, {
                    startingNode: getMonitoredItemMethodId,
                    relativePath: {
                        elements: [
                            {
                                referenceTypeId: hasPropertyRefId,
                                isInverse: false,
                                includeSubtypes: false,
                                targetName: {   name: "OutputArguments" }
                            }
                        ]
                    }
                }
            ];

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {
            session.translateBrowsePath(browsePath, function(err,results) {

                console.log(results[0].toString());
                results[0].statusCode.should.eql(StatusCodes.Good);
                results[0].targets.length.should.eql(1);
                results[0].targets[0].targetId.toString().should.eql("ns=0;i=11493");

                console.log(results[1].toString());
                results[1].statusCode.should.eql(StatusCodes.Good);
                results[1].targets.length.should.eql(1);
                results[1].targets[0].targetId.toString().should.eql("ns=0;i=11494");

                inner_done();

            });
        },done);
    });


});
