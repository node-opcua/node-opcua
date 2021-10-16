import { QualifiedName } from "node-opcua-data-model";
import { KeyValuePair } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

describe("bug KeyValuePair", () => {
    it("KVP1: should create a KeyValuePair Variant", () => {
        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: new KeyValuePair({ key: "A", value: { dataType: DataType.String, value: "B" } })
        });

        v.value.key.name.should.eql("A");
        v.value.value.dataType.should.eql(DataType.String);
        v.value.value.value.should.eql("B");
    });
    it("KVP2: should create a KeyValue Pair", () => {
        const kv = new KeyValuePair({ key: "A", value: { dataType: DataType.String, value: "B" } });
        kv.key.should.be.instanceOf(QualifiedName);
        kv.key.name.should.eql("A");
        kv.value.dataType.should.eql(DataType.String);
        kv.value.value.should.eql("B");
    });
});
