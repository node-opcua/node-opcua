import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import should from "should";
import { ReadRequest, ReadResponse, ReadValueId, TimestampsToReturn } from "..";

describe("test service Read", () => {
    it("should create a empty ReadRequest", () => {
        const readRequest = new ReadRequest({});
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Both);
        should(readRequest.nodesToRead?.length).equal(0);

        encode_decode_round_trip_test(readRequest);
    });

    it("should create a ReadRequest and append ReadValueId to nodesToRead   ", () => {
        const readRequest = new ReadRequest({
            timestampsToReturn: TimestampsToReturn.Both
        });

        readRequest.nodesToRead?.push(new ReadValueId({ nodeId: "i=2255", attributeId: 13 }));

        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Both);
        should(readRequest.nodesToRead?.length).equal(1);

        encode_decode_round_trip_test(readRequest);
    });

    it("should create a ReadRequest", () => {
        const readRequest = new ReadRequest({
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                {
                    nodeId: "i=2255",
                    attributeId: 13
                }
            ]
        });
        readRequest.timestampsToReturn.should.eql(TimestampsToReturn.Both);
        should(readRequest.nodesToRead?.length).equal(1);

        encode_decode_round_trip_test(readRequest);
    });
    it("should raise a exception if ReadRequest is created with a invalid attributeId", () => {
        should(() => {
            const _readRequest = new ReadRequest({
                timestampsToReturn: TimestampsToReturn.Both,
                nodesToRead: [
                    {
                        nodeId: "i=2255",
                        attributeId: 5555 //<<<<<<< INVALID ID => Should Throws !!!
                    }
                ]
            });
        }).throwError();
    });

    it("should create a ReadResponse", () => {
        const readResponse = new ReadResponse({});
        encode_decode_round_trip_test(readResponse);
    });
});
