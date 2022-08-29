"use strict";

const { assert } = require("node-opcua-assert");
const { makeBufferFromTrace } = require("node-opcua-debug");
const { redirectToFile } = require("node-opcua-debug/nodeJS");
const { StatusCodes } = require("node-opcua-status-code");
const { TimestampsToReturn } = require("node-opcua-service-read");

const { makeNodeId } = require("node-opcua-nodeid");
const { makeBuffer } = require("node-opcua-buffer-utils");

const { verify_multi_chunk_message } = require("node-opcua-secure-channel/dist/test_helpers");
const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");

const {
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    MonitoringParameters,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsResponse,
    MonitoringMode,
    SetPublishingModeRequest,
    SetPublishingModeResponse,
    PublishRequest,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsResponse,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsResponse
} = require("..");

describe("testing subscription objects", function () {
    it("should encode and decode a CreateSubscriptionRequest", function (done) {
        const request = new CreateSubscriptionRequest({
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 1000 * 60 * 10, // 10 minutes
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });
        encode_decode_round_trip_test(request);
        done();
    });

    it("should encode and decode a CreateSubscriptionResponse", function (done) {
        const response = new CreateSubscriptionResponse({});
        encode_decode_round_trip_test(response);
        done();
    });

    it("should encode and decode a CreateMonitoredItemsRequest", function (done) {
        const request = new CreateMonitoredItemsRequest({
            subscriptionId: 1,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: {
                        // ReadValue
                        nodeId: makeNodeId("i:100")
                    },
                    monitoringMode: MonitoringMode.Sampling,
                    requestedParameters: {
                        clientHandle: 26,
                        samplingInterval: 100,
                        filter: null,
                        queueSize: 100,
                        discardOldest: true
                    }
                }
            ]
        });
        encode_decode_round_trip_test(request);
        done();
    });

    describe("testing subscription services data structure from the field", function () {
        it("should decode a real CreateMonitoredItemsRequest ", function (done) {
            // a real OpenSecureChannelRequest message chunk
            const ws_CreateMonitoredItemsRequest = makeBuffer(
                "4d 53 47 46 84 00 00 00 01 00 00 00 01 00 00 00 5f 00 00 00 2d 00 00 00 01 00 ef 02 05 00 00 10 " +
                    "00 00 00 ce 74 00 ff 1f 61 a5 2f a9 ac b1 52 43 30 d4 c1 9b 0f cd 7b 09 4a cf 01 02 05 00 00 00 " +
                    "00 00 00 ff ff ff ff 10 27 00 00 00 00 00 03 00 00 00 02 00 00 00 01 00 00 00 01 00 d5 08 0d 00 " +
                    "00 00 ff ff ff ff 00 00 ff ff ff ff 02 00 00 00 0b 00 00 00 00 00 00 00 00 70 a7 40 00 00 00 01 " +
                    "00 00 00 01"
            );

            redirectToFile(
                "CreateMonitoredItemsRequest.log",
                function () {
                    verify_multi_chunk_message([ws_CreateMonitoredItemsRequest]);
                },
                done
            );
        });
        it("should decode a real CreateMonitoredItemResponse", function (done) {
            const ws_CreateMonitoredItemsResponse = makeBuffer(
                "4d 53 47 46 53 00 00 00 fb 58 70 00 01 00 00 00 3a 00 00 00 08 00 00 00 01 00 f2 02 d0 21 53 68 " + //   MSGFS...{Xp.....:.........r.P!Sh
                    "17 51 cf 01 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 00 00 00 39 80 00 00 00 00 " + //     .QO.......................9.....
                    "00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00"
            );

            redirectToFile(
                "CreateMonitoredItemsResponse.log",
                function () {
                    verify_multi_chunk_message([ws_CreateMonitoredItemsResponse]);
                },
                done
            );
        });
    });

    it("should encode and decode a CreateMonitoredItemsResponse", function (done) {
        const response = new CreateMonitoredItemsResponse({});
        encode_decode_round_trip_test(response);
        done();
    });

    it("should encode and decode a MonitoringParameters", function (done) {
        const obj = new MonitoringParameters({});
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteMonitoredItemsRequest", function (done) {
        const obj = new DeleteMonitoredItemsRequest({
            subscriptionId: 100,
            monitoredItemIds: [1, 2, 3, 4]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteMonitoredItemsResponse", function (done) {
        const obj = new DeleteMonitoredItemsResponse({
            responseHeader: { serviceResult: StatusCodes.Good },
            results: [StatusCodes.BadApplicationSignatureInvalid, StatusCodes.Good]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a SetPublishingModeRequest", function (done) {
        const obj = new SetPublishingModeRequest({
            publishingEnabled: true,
            subscriptionIds: [1, 2, 3, 4]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a SetPublishingModeResponse", function (done) {
        const obj = new SetPublishingModeResponse({
            results: [StatusCodes.BadApplicationSignatureInvalid, StatusCodes.Good]
        });
        assert(obj instanceof SetPublishingModeResponse);
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a PublishRequest", function (done) {
        const obj = new PublishRequest({
            subscriptionAcknowledgements: [
                {
                    subscriptionId: 1,
                    sequenceNumber: 1
                },
                {
                    subscriptionId: 2,
                    sequenceNumber: 2
                }
            ]
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a PublishResponse", function (done) {
        const obj = new PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers: [1, 2, 3],
            moreNotifications: true,
            notificationMessage: {
                sequenceNumber: 4,
                publishTime: new Date(),
                notificationData: null // DataChange or EventNotificiation
            },
            results: [StatusCodes.Good],
            diagnosticInfos: []
        });
        encode_decode_round_trip_test(obj);
        done();
    });
    it("should encode and decode a PublishResponse with Error", function (done) {
        const obj = new PublishResponse({
            results: [StatusCodes.BadNoSubscription]
        });

        // by default
        obj.subscriptionId.should.eql(0xffffffff);

        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a MonitoringParametes", function (done) {
        const obj = new MonitoringParameters({});
        // by default
        obj.clientHandle.should.eql(0xffffffff);
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a RepublishRequest", function (done) {
        const obj = new RepublishRequest({
            subscriptionId: 1,
            retransmitSequenceNumber: 20
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a RepublishResponse", function (done) {
        const obj = new RepublishResponse({
            notificationMessage: {
                sequenceNumber: 1,
                publishTime: new Date(),
                notificationData: []
            }
        });
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteSubscriptionsRequest", function (done) {
        const obj = new DeleteSubscriptionsRequest({});
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a DeleteSubscriptionsResponse", function (done) {
        const obj = new DeleteSubscriptionsResponse({});
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a ModifyMonitoredItemsRequest", function (done) {
        const obj = new ModifyMonitoredItemsRequest({});
        encode_decode_round_trip_test(obj);
        done();
    });

    it("should encode and decode a ModifyMonitoredItemsResponse", function (done) {
        const obj = new ModifyMonitoredItemsResponse({});
        encode_decode_round_trip_test(obj);
        done();
    });
});

describe("CreateMonitoredItemsRequest with EventFilter parameters", function () {
    it("should decode this packet from PROSYS ANDROID app", function (done) {
        const ws_CreateMonitoredItemsRequest = makeBufferFromTrace(function () {
            /*
             00000000: 4d 53 47 46 97 01 00 00 09 00 00 00 01 00 00 00 04 00 00 00 04 00 00 00 01 00 ef 02 05 00 00 10    MSGF......................o.....
             00000020: 00 00 00 0a 97 3a d3 aa ac 03 3c ef 5c dc 98 46 af 26 b3 f0 bf 9e 52 02 26 d0 01 94 00 00 00 00    .....:S*,.<o\\.F/&3p?.R.&P......
             00000040: 00 00 00 ff ff ff ff 60 ea 00 00 00 00 00 05 00 00 00 00 00 00 00 02 00 00 00 01 00 cd 08 0c 00    .......`j...................M...
             00000060: 00 00 ff ff ff ff 00 00 ff ff ff ff 02 00 00 00 01 00 00 00 00 00 00 00 00 00 f0 bf 01 00 d7 02    ..........................p?..W.
             00000080: 01 d5 00 00 00 07 00 00 00 01 00 f9 07 01 00 00 00 00 00 09 00 00 00 45 76 65 6e 74 54 79 70 65    .U.........y...........EventType
             000000a0: 0d 00 00 00 ff ff ff ff 01 00 f9 07 01 00 00 00 00 00 07 00 00 00 4d 65 73 73 61 67 65 0d 00 00    ..........y...........Message...
             000000c0: 00 ff ff ff ff 01 00 f9 07 01 00 00 00 00 00 0a 00 00 00 53 6f 75 72 63 65 4e 61 6d 65 0d 00 00    .......y...........SourceName...
             000000e0: 00 ff ff ff ff 01 00 f9 07 01 00 00 00 00 00 04 00 00 00 54 69 6d 65 0d 00 00 00 ff ff ff ff 01    .......y...........Time.........
             00000100: 00 f9 07 01 00 00 00 00 00 08 00 00 00 53 65 76 65 72 69 74 79 0d 00 00 00 ff ff ff ff 01 00 f9    .y...........Severity..........y
             00000120: 07 02 00 00 00 00 00 0b 00 00 00 41 63 74 69 76 65 53 74 61 74 65 00 00 02 00 00 00 49 64 0d 00    ...........ActiveState......Id..
             00000140: 00 00 ff ff ff ff 01 00 f9 07 ff ff ff ff 01 00 00 00 ff ff ff ff ff ff ff ff d5 00 00 00 00 03    ........y.................U.....
             00000160: 01 00 0b 00 00 00 54 65 6d 70 65 72 61 74 75 72 65 0d 00 00 00 ff ff ff ff 00 00 ff ff ff ff 02    ......Temperature...............
             00000180: 00 00 00 03 00 00 00 00 00 00 00 00 40 8f 40 00 00 00 01 00 00 00 00                               ............@.@........
             */
        });
        redirectToFile(
            "CreateMonitoredItemsRequest2.log",
            function () {
                verify_multi_chunk_message([ws_CreateMonitoredItemsRequest]);
            },
            done
        );
    });
});
