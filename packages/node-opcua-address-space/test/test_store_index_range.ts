import { readFileSync } from "node:fs";
import { StoreAddressSpace, type StoreVariableView } from "node-opcua-address-space-store";
import { AttributeIds, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import { WriteValue } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { CompactAddressSpaceServices, compactRecordConsumer } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";

describe("store index ranges: a range of an array Value read and written on a compact Variable", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let services: CompactAddressSpaceServices;
    let array: StoreVariableView;
    let scalar: StoreVariableView;
    let matrix: StoreVariableView;
    const range = (s: string) => new NumericRange(s);
    const int32s = (values: number[]) =>
        new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: values });

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192 });
        const consumer = compactRecordConsumer(space);
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        consumer.finish();
        space.registerNamespace("urn:test:ranges");
        services = new CompactAddressSpaceServices(space);
        const objects = space.findNode("ns=0;i=85") as never;
        array = space.addVariable({
            nodeId: "ns=1;s=Array",
            browseName: "Array",
            organizedBy: objects,
            dataType: "Int32",
            valueRank: 1
        });
        array.setValueFromSource(int32s([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
        scalar = space.addVariable({ nodeId: "ns=1;s=Scalar", browseName: "Scalar", organizedBy: objects, dataType: "Double" });
        scalar.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1.5 }));
        matrix = space.addVariable({
            nodeId: "ns=1;s=Matrix",
            browseName: "Matrix",
            organizedBy: objects,
            dataType: "Int32",
            valueRank: 2
        });
        matrix.setValueFromSource(
            new Variant({
                dataType: DataType.Int32,
                arrayType: VariantArrayType.Matrix,
                dimensions: [2, 3],
                value: [1, 2, 3, 4, 5, 6]
            })
        );
    });

    it("reads a range of an array through the view", () => {
        should(Array.from(array.readValue(null, range("2:4")).value.value as ArrayLike<number>)).eql([2, 3, 4]);
        should(Array.from(array.readValue(null, range("7")).value.value as ArrayLike<number>)).eql([7]);
        should(array.readValue(null, range("20:30")).statusCode).eql(StatusCodes.BadIndexRangeNoData);
        should(array.readValue(null, range("5:2")).statusCode).eql(StatusCodes.BadIndexRangeInvalid);
        should(Array.from(array.readValue().value.value as ArrayLike<number>)).eql(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            "the stored array is untouched"
        );
        should(Array.from(array.readAttribute(null, AttributeIds.Value, range("1:2")).value.value as ArrayLike<number>)).eql([
            1, 2
        ]);
        should(Array.from(matrix.readValue(null, range("1,0:1")).value.value as ArrayLike<number>)).eql([4, 5]);
    });

    it("refuses a range or an encoding on an attribute other than the Value", () => {
        should(array.readAttribute(null, AttributeIds.BrowseName, range("0:1")).statusCode).eql(StatusCodes.BadIndexRangeNoData);
        should(array.readAttribute(null, AttributeIds.BrowseName, null, new QualifiedName({ name: "Default XML" })).statusCode).eql(
            StatusCodes.BadDataEncodingInvalid
        );
        should(scalar.readValue(null, null, new QualifiedName({ name: "Default XML" })).statusCode).eql(
            StatusCodes.BadDataEncodingInvalid
        );
        should(scalar.readValue(null, null, new QualifiedName({ name: "DefaultBinary" })).statusCode).eql(
            StatusCodes.Good,
            "the binary encoding is the one every value has"
        );
    });

    it("reads a range through the Read service, without a view where none is needed", () => {
        const read = (nodeId: string, indexRange?: string) =>
            services.read(
                null,
                { nodeId, attributeId: AttributeIds.Value, indexRange: indexRange ? range(indexRange) : undefined },
                0
            );
        should(Array.from(read("ns=1;s=Array", "3:5").value.value as ArrayLike<number>)).eql([3, 4, 5]);
        should(read("ns=1;s=Array").value.value.length).eql(10);
        should(read("ns=1;s=Scalar", "0:1").statusCode).eql(
            StatusCodes.Good,
            "a range on a scalar is ignored, as on the node objects"
        );
        should(read("ns=1;s=Scalar", "0:1").value.value).eql(1.5);
    });

    it("writes a range of an array: the new elements land in the stored array", () => {
        const write = (nodeId: string, variant: Variant, indexRange?: string) =>
            services.write(
                null,
                new WriteValue({
                    nodeId,
                    attributeId: AttributeIds.Value,
                    indexRange: indexRange ? range(indexRange) : undefined,
                    value: new DataValue({ value: variant })
                })
            );
        should(write("ns=1;s=Array", int32s([70, 80, 90]), "7:9")).eql(StatusCodes.Good.value);
        should(Array.from(array.readValue().value.value as ArrayLike<number>)).eql([0, 1, 2, 3, 4, 5, 6, 70, 80, 90]);
        should(write("ns=1;s=Array", int32s([1, 2]), "7:9")).eql(
            StatusCodes.BadIndexRangeInvalid.value,
            "two values for a range of three"
        );
        should(write("ns=1;s=Array", int32s([1]), "5:2")).eql(StatusCodes.BadIndexRangeInvalid.value);
        should(write("ns=1;s=Array", int32s([1]), "12")).eql(StatusCodes.BadIndexRangeNoData.value, "past the end");
        should(write("ns=1;s=Scalar", new Variant({ dataType: DataType.Double, value: 2 }), "0")).eql(
            StatusCodes.BadTypeMismatch.value,
            "no array to write into"
        );
        should(write("ns=1;s=Array", new Variant({ dataType: DataType.Int32, value: 5 }), "0")).eql(
            StatusCodes.BadTypeMismatch.value,
            "a scalar into a range"
        );
        should(write("ns=1;s=Array", int32s([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]))).eql(
            StatusCodes.Good.value,
            "no range: the whole array"
        );
        should(Array.from(array.readValue().value.value as ArrayLike<number>)).eql([
            100, 101, 102, 103, 104, 105, 106, 107, 108, 109
        ]);
    });

    it("writes a range of a matrix", () => {
        const status = matrix.writeValue(
            new DataValue({
                value: new Variant({
                    dataType: DataType.Int32,
                    arrayType: VariantArrayType.Matrix,
                    dimensions: [1, 2],
                    value: [40, 50]
                })
            }),
            null,
            range("1,0:1")
        );
        should(status).eql(StatusCodes.Good.value);
        should(Array.from(matrix.readValue().value.value as ArrayLike<number>)).eql([1, 2, 3, 40, 50, 6]);
        should(matrix.readValue().value.dimensions).eql([2, 3]);
    });

    it("notifies a listener with the whole array after a ranged write", () => {
        let seen: DataValue | undefined;
        array.on("value_changed", (dataValue: DataValue) => {
            seen = dataValue;
        });
        array.writeValue(new DataValue({ value: int32s([-1]) }), null, range("0"));
        const values = Array.from((seen as DataValue).value.value as ArrayLike<number>);
        should(values[0]).eql(-1);
        should(values.length).eql(10);
    });
});
