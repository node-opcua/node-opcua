import "should"; // side-effect for should assertions
import { assert } from "node-opcua-assert";
import { makeBufferFromTrace } from "node-opcua-debug";
import { redirectToFile } from "node-opcua-debug/nodeJS";
import { StatusCodes } from "node-opcua-status-code";
import { TimestampsToReturn } from "node-opcua-service-read";
import { makeNodeId } from "node-opcua-nodeid";
import { verify_multi_chunk_message } from "node-opcua-secure-channel/dist/test_helpers";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import {
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
} from "..";
import { redirectToFileAsync } from "node-opcua-debug/distNodeJS/redirect_to_file";


describe("testing subscription objects", function () {

    it("should encode and decode a CreateSubscriptionRequest", () => {
        const obj = new CreateSubscriptionRequest({
            requestedPublishingInterval: 1000,
            requestedLifetimeCount: 1000 * 60 * 10, // 10 minutes
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 6
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a CreateMonitoredItemsRequest", () => {
        const obj = new CreateMonitoredItemsRequest({
            subscriptionId: 1,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToCreate: [
                {
                    itemToMonitor: { nodeId: makeNodeId(0), attributeId: 13 },
                    monitoringMode: MonitoringMode.Reporting,
                    requestedParameters: new MonitoringParameters({
                        clientHandle: 1,
                        samplingInterval: 1000,
                        filter: null as any,
                        queueSize: 10,
                        discardOldest: true
                    })
                }
            ]
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a CreateMonitoredItemsResponse", () => {
        const obj = new CreateMonitoredItemsResponse({
            results: [],
            diagnosticInfos: []
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode MonitoringParameters", () => {
        const obj = new MonitoringParameters({ clientHandle: 0xaaaaaaaa });
        obj.clientHandle.should.eql(0xaaaaaaaa);
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a DeleteMonitoredItemsRequest", () => {
        const obj = new DeleteMonitoredItemsRequest({
            subscriptionId: 100,
            monitoredItemIds: [1, 2, 3, 4]
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a DeleteMonitoredItemsResponse", () => {
        const obj = new DeleteMonitoredItemsResponse({
            responseHeader: { serviceResult: StatusCodes.Good },
            results: [StatusCodes.BadApplicationSignatureInvalid, StatusCodes.Good]
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a SetPublishingModeRequest", () => {
        const obj = new SetPublishingModeRequest({
            publishingEnabled: true,
            subscriptionIds: [1, 2, 3, 4]
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a SetPublishingModeResponse", () => {
        const obj = new SetPublishingModeResponse({
            results: [StatusCodes.BadApplicationSignatureInvalid, StatusCodes.Good]
        });
        assert(obj instanceof SetPublishingModeResponse);
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a PublishRequest", () => {
        const obj = new PublishRequest({
            subscriptionAcknowledgements: [
                { subscriptionId: 1, sequenceNumber: 1 },
                { subscriptionId: 2, sequenceNumber: 2 }
            ]
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a PublishResponse", () => {
        const obj = new PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers: [1, 2, 3],
            moreNotifications: true,
            notificationMessage: {
                sequenceNumber: 4,
                publishTime: new Date(),
                notificationData: null as any
            },
            results: [StatusCodes.Good],
            diagnosticInfos: []
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a PublishResponse with Error", () => {
        const obj = new PublishResponse({ results: [StatusCodes.BadNoSubscription] });
        obj.subscriptionId.should.eql(0xffffffff);
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a RepublishRequest", () => {
        const obj = new RepublishRequest({ subscriptionId: 1, retransmitSequenceNumber: 20 });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a RepublishResponse", () => {
        const obj = new RepublishResponse({
            notificationMessage: { sequenceNumber: 1, publishTime: new Date(), notificationData: [] }
        });
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a DeleteSubscriptionsRequest", () => {
        const obj = new DeleteSubscriptionsRequest({ subscriptionIds: [1, 2, 3] } as any);
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a DeleteSubscriptionsResponse", () => {
        const obj = new DeleteSubscriptionsResponse({ results: [StatusCodes.Good, StatusCodes.Good] } as any);
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a ModifyMonitoredItemsRequest", () => {
        const obj = new ModifyMonitoredItemsRequest({
            subscriptionId: 1,
            timestampsToReturn: TimestampsToReturn.Both,
            itemsToModify: []
        } as any);
        encode_decode_round_trip_test(obj);
    });

    it("should encode and decode a ModifyMonitoredItemsResponse", () => {
        const obj = new ModifyMonitoredItemsResponse({ results: [], diagnosticInfos: [] } as any);
        encode_decode_round_trip_test(obj);
    });

});

describe("CreateMonitoredItemsRequest with EventFilter parameters", function () {

    it("should decode this packet from PROSYS ANDROID app", async () => {
        const ws_CreateMonitoredItemsRequest = makeBufferFromTrace(
            `00000000: 4d 53 47 46 97 01 00 00 09 00 00 00 01 00 00 00 04 00 00 00 04 00 00 00 01 00 ef 02 05 00 00 10    MSGF......................o.....\n
                 00000020: 00 00 00 0a 97 3a d3 aa ac 03 3c ef 5c dc 98 46 af 26 b3 f0 bf 9e 52 02 26 d0 01 94 00 00 00 00    .....:S*,.<o\\\\.F/&3p?.R.&P......\n
                 00000040: 00 00 00 ff ff ff ff 60 ea 00 00 00 00 00 05 00 00 00 00 00 00 00 02 00 00 00 01 00 cd 08 0c 00    .......\`j...................M...\n
                 00000060: 00 00 ff ff ff ff 00 00 ff ff ff ff 02 00 00 00 01 00 00 00 00 00 00 00 00 00 f0 bf 01 00 d7 02    ..........................p?..W.\n
                 00000080: 01 d5 00 00 00 07 00 00 00 01 00 f9 07 01 00 00 00 00 00 09 00 00 00 45 76 65 6e 74 54 79 70 65    .U.........y...........EventType\n
                 000000a0: 0d 00 00 00 ff ff ff ff 01 00 f9 07 01 00 00 00 00 00 07 00 00 00 4d 65 73 73 61 67 65 0d 00 00    ..........y...........Message...\n
                 000000c0: 00 ff ff ff ff 01 00 f9 07 01 00 00 00 00 00 0a 00 00 00 53 6f 75 72 63 65 4e 61 6d 65 0d 00 00    .......y...........SourceName...\n
                 000000e0: 00 ff ff ff ff 01 00 f9 07 01 00 00 00 00 00 04 00 00 00 54 69 6d 65 0d 00 00 00 ff ff ff ff 01    .......y...........Time.........\n
                 00000100: 00 f9 07 01 00 00 00 00 00 08 00 00 00 53 65 76 65 72 69 74 79 0d 00 00 00 ff ff ff ff 01 00 f9    .y...........Severity..........y\n
                 00000120: 07 02 00 00 00 00 00 0b 00 00 00 41 63 74 69 76 65 53 74 61 74 65 00 00 02 00 00 00 49 64 0d 00    ...........ActiveState......Id..\n
                 00000140: 00 00 ff ff ff ff 01 00 f9 07 ff ff ff ff 01 00 00 00 ff ff ff ff ff ff ff ff d5 00 00 00 00 03    ........y.................U.....\n
                 00000160: 01 00 0b 00 00 00 54 65 6d 70 65 72 61 74 75 72 65 0d 00 00 00 ff ff ff ff 00 00 ff ff ff ff 02    ......Temperature...............\n
                 00000180: 00 00 00 03 00 00 00 00 00 00 00 00 40 8f 40 00 00 00 01 00 00 00 00                               ............@.@........`
        );
        await redirectToFileAsync("CreateMonitoredItemsRequest2.log", async () => {
            verify_multi_chunk_message([ws_CreateMonitoredItemsRequest]);
            return;
        });
    });
});
