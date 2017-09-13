var should = require("should");
var rs = require("..");

var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

describe("test service Read",function() {

    it("should create a empty ReadRequest", function () {
        var readRequest = new rs.ReadRequest({});

        readRequest.timestampsToReturn.should.eql(rs.TimestampsToReturn.Invalid);
        readRequest.nodesToRead.length.should.equal(0);

        encode_decode_round_trip_test(readRequest);
    });

    it("should create a ReadRequest and append ReadValueId to nodesToRead   ", function () {

        var readRequest = new rs.ReadRequest({
            timestampsToReturn: rs.TimestampsToReturn.Both
        });

        readRequest.nodesToRead.push(new rs.ReadValueId({nodeId: "i=2255", attributeId: 13}));

        readRequest.timestampsToReturn.should.eql(rs.TimestampsToReturn.Both);
        readRequest.nodesToRead.length.should.equal(1);

        encode_decode_round_trip_test(readRequest);
    });

    it("should create a ReadRequest", function () {
        var readRequest = new rs.ReadRequest({
            timestampsToReturn: rs.TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: "i=2255",
                    attributeId: 13
                }
            ]
        });
        readRequest.timestampsToReturn.should.eql(rs.TimestampsToReturn.Both);
        readRequest.nodesToRead.length.should.equal(1);

        encode_decode_round_trip_test(readRequest);
    });
    it("should raise a exception if ReadRequest is created with a invalid attributeId", function () {

        should(function () {
            var readRequest = new rs.ReadRequest({
                timestampsToReturn: rs.TimestampsToReturn.Both,
                nodesToRead: [
                    {
                        nodeId: "i=2255",
                        attributeId: 5555  //<<<<<<< INVALID ID => Should Throws !!!
                    }
                ]
            });
        }).throwError();

    });

    it("should create a ReadResponse", function () {
        var readResponse = new rs.ReadResponse({});
        encode_decode_round_trip_test(readResponse);
    });
});