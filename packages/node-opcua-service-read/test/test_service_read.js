const should = require("should");
const TimestampsToReturn = require("..").TimestampsToReturn;
const ReadRequest = require("..").ReadRequest;
const ReadValueId = require("..").ReadValueId;
const ReadResponse = require("..").ReadResponse;



const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers").encode_decode_round_trip_test;

describe("test service Read",function() {

    it("should create a empty ReadRequest", function () {
        const readRequest = new ReadRequest({});
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Both);
        readRequest.nodesToRead.length.should.equal(0);

        encode_decode_round_trip_test(readRequest);
    });

    it("should create a ReadRequest and append ReadValueId to nodesToRead   ", function () {

        const readRequest = new ReadRequest({
            timestampsToReturn: TimestampsToReturn.Both
        });

        readRequest.nodesToRead.push(new ReadValueId({nodeId: "i=2255", attributeId: 13}));

        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Both);
        readRequest.nodesToRead.length.should.equal(1);

        encode_decode_round_trip_test(readRequest);
    });

    it("should create a ReadRequest", function () {
        const readRequest = new ReadRequest({
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [{
                nodeId: "i=2255",
                attributeId: 13
            }]
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Both);
        readRequest.nodesToRead.length.should.equal(1);

        encode_decode_round_trip_test(readRequest);
    });
    it("should raise a exception if ReadRequest is created with a invalid attributeId", function () {

        should(function () {
            const readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Both,
                nodesToRead: [{
                        nodeId: "i=2255",
                        attributeId: 5555  //<<<<<<< INVALID ID => Should Throws !!!
                }]
            });
        }).throwError();

    });

    it("should create a ReadResponse", function () {
        const readResponse = new ReadResponse({});
        encode_decode_round_trip_test(readResponse);
    });
});
