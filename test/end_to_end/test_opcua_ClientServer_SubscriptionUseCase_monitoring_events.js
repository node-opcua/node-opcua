/*global xit,it,describe,before,after,beforeEach,afterEach*/
"use strict";
require("requirish")._(module);
var assert = require("better-assert");
var async = require("async");
var should = require("should");
var sinon = require("sinon");

var opcua = require("index.js");

var OPCUAClient = opcua.OPCUAClient;
var ClientSession = opcua.ClientSession;
var ClientSubscription = opcua.ClientSubscription;
var AttributeIds = opcua.AttributeIds;
var resolveNodeId = opcua.resolveNodeId;
var StatusCodes = opcua.StatusCodes;
var DataType = opcua.DataType;
var TimestampsToReturn = opcua.read_service.TimestampsToReturn;
var MonitoringMode = opcua.subscription_service.MonitoringMode;

var build_server_with_temperature_device = require("test/helpers/build_server_with_temperature_device").build_server_with_temperature_device;
var perform_operation_on_client_session = require("test/helpers/perform_operation_on_client_session").perform_operation_on_client_session;
var perform_operation_on_subscription = require("test/helpers/perform_operation_on_client_session").perform_operation_on_subscription;
var perform_operation_on_monitoredItem = require("test/helpers/perform_operation_on_client_session").perform_operation_on_monitoredItem;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


// make sure extra error checking is made on object constructions
var schema_helpers =  require("lib/misc/factories_schema_helpers");
schema_helpers.doDebug = true;

describe("testing Client-Server subscription use case, on a fake server exposing the temperature device", function () {

    var server, client, temperatureVariableId, endpointUrl;

    var port = 2000;

    before(function (done) {

        resourceLeakDetector.start();
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;
        server = build_server_with_temperature_device({
            port: port
        }, function (err) {
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
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(function (err) {
            resourceLeakDetector.stop();
            done(err);
        });
    });


    it("should create a monitoredItem on a event with a Filter", function (done) {

        var subscription_service = opcua.subscription_service;
        var NumericRange = opcua.NumericRange;

        var filter = new subscription_service.EventFilter({
            selectClauses: [// SimpleAttributeOperand
                {
                    typeId: "i=123", // NodeId

                    browsePath: [    // QualifiedName
                        {namespaceIndex: 1, name: "A"}, {namespaceIndex: 1, name: "B"}, {namespaceIndex: 1, name: "C"}
                    ],
                    attributeId: AttributeIds.Value,
                    indexRange: new NumericRange()
                },
                {
                    // etc...
                },
                {
                    // etc...
                }
            ],
            whereClause: { //ContentFilter
                elements: [ // ContentFilterElement
                    {
                        filterOperator: subscription_service.FilterOperator.IsNull,
                        filterOperands: [ //
                            new subscription_service.ElementOperand({
                                index: 123
                            }),
                            new subscription_service.AttributeOperand({
                                nodeId: "i=10",
                                alias: "someText",
                                browsePath: { //RelativePath

                                },
                                attributeId: AttributeIds.Value
                            })
                        ]
                    }
                ]
            }
        });


        perform_operation_on_subscription(client, endpointUrl, function (session, subscription, callback) {

            var VariableIds = opcua.VariableIds;
            var nodeId = opcua.makeNodeId(VariableIds.Server_ServerArray);

            var samplingInterval = 1000;

            var itemToMonitor = new opcua.read_service.ReadValueId({
                nodeId: nodeId,
                attributeId: AttributeIds.Value,
                indexRange: "1:2,3:4"
            });
            var parameters = {
                samplingInterval: samplingInterval,
                discardOldest: false,
                queueSize: 1,


                filter: filter

            };

            var createMonitoredItemsRequest = new opcua.subscription_service.CreateMonitoredItemsRequest({

                subscriptionId: subscription.subscriptionId,

                timestampsToReturn: opcua.read_service.TimestampsToReturn.Neither,

                itemsToCreate: [{
                    itemToMonitor:       itemToMonitor,
                    requestedParameters: parameters,
                    monitoringMode:      MonitoringMode.Reporting
                }]
            });
            session.createMonitoredItems(createMonitoredItemsRequest, function (err, createMonitoredItemsResponse) {
                createMonitoredItemsResponse.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                createMonitoredItemsResponse.results[0].statusCode.should.eql(StatusCodes.Good);
                callback();
            });

            // now publish and check that monitored item returns
        }, done);
    });
});


