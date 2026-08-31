import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NumericRange, NumericRangeType } from "node-opcua-numeric-range";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import { ServerStatusDataType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { WriteRequest, WriteResponse, WriteValue } from "../dist/index.js";

describe("Write Service", () => {
    it("should create a WriteValue", () => {
        new WriteValue({});
    });
    it("should create a WriteRequest", () => {
        new WriteRequest({});
    });
    it("should create a WriteResponse", () => {
        new WriteResponse({});
    });
});

describe("WriteValue", () => {
    it("should create a default WriteValue", () => {
        const wv = new WriteValue({});
        wv.indexRange.type.should.equal(NumericRangeType.Empty);
    });

    it("should create a write value with a DataValue containing a Extension Object", () => {
        const dataValue = {
            value: {
                dataType: DataType.ExtensionObject,
                value: new ServerStatusDataType({})
            }
        };
        const writeValue = new WriteValue({
            attributeId: AttributeIds.Value,
            value: dataValue
        });
        writeValue.value.should.be.instanceOf(DataValue);
        writeValue.value.value.dataType.should.eql(DataType.ExtensionObject);
        writeValue.value.value.value.should.be.instanceOf(ServerStatusDataType);
    });
});
describe("WriteRequest", () => {
    it("should create a default WriteRequest", () => {
        const wv = new WriteRequest({
            nodesToWrite: [{}, {}]
        });

        const nodesToWrite = wv.nodesToWrite;
        if (!nodesToWrite) {
            throw new Error("expecting WriteRequest to default nodesToWrite to an array");
        }
        nodesToWrite[0].indexRange.should.be.instanceOf(NumericRange);
        should(nodesToWrite[0].indexRange.type).equal(NumericRangeType.Empty);

        encode_decode_round_trip_test(wv);
    });
});
