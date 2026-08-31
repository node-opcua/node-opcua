import { DataValue } from "node-opcua-data-value";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { Argument, EUInformation, Range } from "../dist/index.js";

//
// The server clones every sampled DataValue on the monitored-item path and keeps the
// clone, so the clone must not share mutable state with the source. That is easy to
// believe for a scalar and easy to get wrong for an ExtensionObject, whose fields may
// themselves be arrays or further ExtensionObjects.
//
// node-opcua-data-value cannot depend on node-opcua-types, so the ExtensionObject half of
// the clone contract is pinned here, against real generated types.
//

describe("DataValue.clone with ExtensionObject payloads", () => {
    it("should give the clone its own ExtensionObject instance", () => {
        const argument = new Argument({ name: "original" });
        const source = new DataValue({ value: new Variant({ dataType: DataType.ExtensionObject, value: argument }) });

        const clone = source.clone();

        clone.value.value.should.not.equal(argument, "the clone must not reference the source ExtensionObject");
    });

    it("should isolate a simple field of the ExtensionObject", () => {
        const source = new DataValue({
            value: new Variant({ dataType: DataType.ExtensionObject, value: new Argument({ name: "original" }) })
        });

        const clone = source.clone();
        source.value.value.name = "mutated";

        clone.value.value.name.should.eql("original");
    });

    it("should isolate an array field of the ExtensionObject", () => {
        // arrayDimensions is a UInt32[]; sharing the array would let a later write to the
        // source rewrite an already-recorded sample
        const source = new DataValue({
            value: new Variant({
                dataType: DataType.ExtensionObject,
                value: new Argument({ name: "a", arrayDimensions: [1, 2, 3] })
            })
        });

        const clone = source.clone();
        clone.value.value.arrayDimensions.should.not.equal(source.value.value.arrayDimensions);

        source.value.value.arrayDimensions[0] = 999;

        clone.value.value.arrayDimensions[0].should.eql(1);
    });

    it("should isolate a nested structure field of the ExtensionObject", () => {
        const source = new DataValue({
            value: new Variant({
                dataType: DataType.ExtensionObject,
                value: new Argument({ name: "a", description: { text: "original" } })
            })
        });

        const clone = source.clone();
        source.value.value.description.text = "mutated";

        clone.value.value.description.text.should.eql("original");
    });

    it("should isolate every element of an ExtensionObject array", () => {
        const source = new DataValue({
            value: new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: [new Argument({ name: "first" }), new Argument({ name: "second" })]
            })
        });

        const clone = source.clone();

        clone.value.value.should.not.equal(source.value.value, "the outer array must be copied");
        clone.value.value[0].should.not.equal(source.value.value[0], "each element must be copied");

        source.value.value[0].name = "mutated";

        clone.value.value[0].name.should.eql("first");
        clone.value.value[1].name.should.eql("second");
    });

    it("should isolate a deeply nested ExtensionObject", () => {
        const source = new DataValue({
            value: new Variant({
                dataType: DataType.ExtensionObject,
                value: new EUInformation({ displayName: { text: "original" }, description: { text: "d" } })
            })
        });

        const clone = source.clone();
        source.value.value.displayName.text = "mutated";

        clone.value.value.displayName.text.should.eql("original");
    });

    it("should preserve the values it copies", () => {
        const range = new Range({ low: 1.5, high: 9.5 });
        const source = new DataValue({ value: new Variant({ dataType: DataType.ExtensionObject, value: range }) });

        const clone = source.clone();

        clone.value.value.low.should.eql(1.5);
        clone.value.value.high.should.eql(9.5);
        clone.value.dataType.should.eql(DataType.ExtensionObject);
    });

    it("should still encode to the same bytes as the source", () => {
        // the clone has to be interchangeable with the source on the wire, not merely
        // structurally similar
        const source = new DataValue({
            value: new Variant({
                dataType: DataType.ExtensionObject,
                value: new Argument({ name: "wire", valueRank: 2, arrayDimensions: [4, 5] })
            })
        });

        const clone = source.clone();

        should(clone.binaryStoreSize()).eql(source.binaryStoreSize());
        clone.toString().should.eql(source.toString());
    });
});
