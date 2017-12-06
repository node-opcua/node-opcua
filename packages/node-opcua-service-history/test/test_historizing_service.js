"use strict";
var read_service = require("node-opcua-service-read");
var TimestampsToReturn = read_service.TimestampsToReturn;

var hs = require("..");
var ReadEventDetails = hs.ReadEventDetails;

var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test


describe("Historizing Service", function () {

    it("should create a empty HistoryReadRequest", function () {
        var readRequest = new hs.HistoryReadRequest({});
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        readRequest.nodesToRead.length.should.equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadEventDetails", function () {
        var readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new ReadEventDetails({})
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        readRequest.nodesToRead.length.should.equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadRawModifiedDetails", function () {
        var readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadRawModifiedDetails({
                isReadModified: true,
                startTime: new Date(2015,10,13),
                endTime: new Date(2015,11,10),
                numValuesPerNode: 1200,
                returnBounds: false
            })
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        readRequest.nodesToRead.length.should.equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadProcessedDetails", function () {
        var readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadProcessedDetails({})
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        readRequest.nodesToRead.length.should.equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with historyReadDetails as a ReadAtTimeDetails", function () {
        var readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadAtTimeDetails({})
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        readRequest.nodesToRead.length.should.equal(0);
        encode_decode_round_trip_test(readRequest);
    });

    it("should create a HistoryReadRequest with nodesToRead", function () {
        var readRequest = new hs.HistoryReadRequest({
            historyReadDetails: new hs.ReadAtTimeDetails({}),
            nodesToRead: [
                {
                    nodeId: "ns=1;i=100",
                    indexRange: "<index_range>"
                },
                {
                    nodeId: "ns=1;i=100",
                    indexRange: "<index_range>"
                }
            ]
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Neither);
        readRequest.nodesToRead.length.should.equal(2);
        encode_decode_round_trip_test(readRequest);
    });

});
