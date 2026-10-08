import { BinaryStream } from "node-opcua-binary-stream";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { encodedBodyOf, retainEncodedBodies, retainEncodedBody } from "node-opcua-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { DataChangeNotification, PublishRequest, PublishResponse, ReadRequest, WriteValue } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { EncodedResponse } from "../source/front_threads/encoded_response.js";
import {
    decodeDataValues,
    decodeMessageBody,
    decodeStructures,
    encodeDataValues,
    encodeMessageBody,
    encodeStructures,
    transferablesOf
} from "../source/front_threads/protocol.js";

describe("the messages between the engine and the front threads", () => {
    it("carries the WriteValues of a Write in one buffer, decoded back in order", () => {
        const writeValues = Array.from(
            { length: 1000 },
            (_, k) =>
                new WriteValue({
                    nodeId: `ns=1;i=${1000 + k}`,
                    attributeId: AttributeIds.Value,
                    value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value: k }) })
                })
        );
        const bytes = encodeStructures(writeValues);
        should(bytes).be.instanceOf(Uint8Array);
        const decoded = decodeStructures(bytes, WriteValue.prototype);
        should(decoded.length).eql(1000);
        for (let k = 0; k < 1000; k++) {
            should(decoded[k]).be.instanceOf(WriteValue);
            should(decoded[k].nodeId.toString()).eql(`ns=1;i=${1000 + k}`);
            should(decoded[k].attributeId).eql(AttributeIds.Value);
            should(decoded[k].value.value.value).eql(k);
        }
    });

    it("hands a large value over in the buffer it was encoded into, and copies a small one off the pool", () => {
        const large = encodeDataValues([
            new DataValue({
                value: new Variant({
                    dataType: DataType.Int32,
                    arrayType: VariantArrayType.Array,
                    value: new Int32Array(1024 * 1024)
                })
            })
        ]);
        // bytes of their own, of exactly their length: nothing else of a pool travels with them
        should(large.byteOffset).eql(0);
        should(large.buffer.byteLength).eql(large.byteLength);
        should(decodeDataValues(large)[0].value.value.length).eql(1024 * 1024);

        const small = encodeDataValues([new DataValue({ value: new Variant({ dataType: DataType.Double, value: 1 }) })]);
        should(small.byteOffset).eql(0);
        should(small.buffer.byteLength).eql(small.byteLength);
    });

    it("transfers the large payloads of a message only", () => {
        const large = new Uint8Array(1024 * 1024);
        const small = new Uint8Array(100);
        const transfer = transferablesOf([large, small, null, 42, "text"]);
        should(transfer.length).eql(1);
        should(transfer[0]).equal(large.buffer);
    });
});

describe("a forwarded request or response, as its bytes", () => {
    const publishResponse = () =>
        new PublishResponse({
            responseHeader: { requestHandle: 77, serviceResult: StatusCodes.Good },
            subscriptionId: 5,
            notificationMessage: {
                sequenceNumber: 9,
                notificationData: [
                    new DataChangeNotification({
                        monitoredItems: [
                            { clientHandle: 1, value: new DataValue({ value: { dataType: DataType.Double, value: 2.5 } }) }
                        ]
                    })
                ]
            }
        });

    it("decodes the message body of a response back into its class", () => {
        const decoded = decodeMessageBody<PublishResponse>(encodeMessageBody(publishResponse()));
        should(decoded).be.instanceOf(PublishResponse);
        should(decoded.subscriptionId).eql(5);
        should(decoded.notificationMessage.sequenceNumber).eql(9);
    });

    it("writes the fields of an EncodedResponse as they were encoded, its header decoded for those who look", () => {
        const response = publishResponse();
        const encoded = new EncodedResponse(encodeMessageBody(response), "PublishResponse");
        should(encoded.responseHeader.requestHandle).eql(77);
        should(encoded.schema.encodingDefaultBinary.toString()).eql(response.schema.encodingDefaultBinary?.toString());
        const expected = new BinaryStream(4096);
        response.encode(expected);
        const written = new BinaryStream(4096);
        encoded.encode(written);
        should(written.length).eql(expected.length);
        should(Buffer.compare(written.buffer.subarray(0, written.length), expected.buffer.subarray(0, expected.length))).eql(0);
    });

    it("keeps the body of the request types asked for, as the channel received it", () => {
        retainEncodedBodies(["PublishRequest"]);
        const body = Buffer.from([1, 2, 3]);
        const publish = new PublishRequest({});
        retainEncodedBody(publish, "PublishRequest", body);
        should(Array.from(encodedBodyOf(publish) ?? [])).eql([1, 2, 3]);
        const read = new ReadRequest({});
        retainEncodedBody(read, "ReadRequest", body);
        should(encodedBodyOf(read)).eql(undefined);
    });
});
