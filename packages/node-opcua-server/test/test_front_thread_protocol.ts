import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { WriteValue } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import {
    decodeDataValues,
    decodeStructures,
    encodeDataValues,
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
