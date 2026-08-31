import type { NumericRange } from "node-opcua-numeric-range";
import * as read_service from "node-opcua-service-read";
import should from "should";

const TimestampsToReturn = read_service.TimestampsToReturn;

import * as hs from "../dist/index.js";

const ReadEventDetails = hs.ReadEventDetails;

import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";

describe("Historizing Service", () => {
    it("should create a empty HistoryReadRequest", () => {
        const readRequest = new hs.HistoryReadRequest({});
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        should(readRequest.nodesToRead?.length).equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadEventDetails", () => {
        const readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new ReadEventDetails({})
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        should(readRequest.nodesToRead?.length).equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadRawModifiedDetails", () => {
        const readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadRawModifiedDetails({
                isReadModified: true,
                startTime: new Date(2015, 10, 13),
                endTime: new Date(2015, 11, 10),
                numValuesPerNode: 1200,
                returnBounds: false
            })
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        should(readRequest.nodesToRead?.length).equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadProcessedDetails", () => {
        const readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadProcessedDetails({})
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        should(readRequest.nodesToRead?.length).equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadAtTimeDetails", () => {
        const readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadAtTimeDetails({})
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        should(readRequest.nodesToRead?.length).equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with nodesToRead", () => {
        const readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadAtTimeDetails({}),
            nodesToRead: [
                {
                    nodeId: "ns=1;i=100",
                    // the generated options type says NumericRange; the runtime coerces a string,
                    // but there is no NumericRangeLike for the generator to emit
                    indexRange: "<index_range>" as unknown as NumericRange
                },
                {
                    nodeId: "ns=1;i=100",
                    // the generated options type says NumericRange; the runtime coerces a string,
                    // but there is no NumericRangeLike for the generator to emit
                    indexRange: "<index_range>" as unknown as NumericRange
                }
            ]
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        should(readRequest.nodesToRead?.length).equal(2);
        encode_decode_round_trip_test(readRequest);
    });
});
