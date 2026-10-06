import { DataType } from "node-opcua-variant";
import should from "should";
import { ValueKind, ValueStore } from "../source/index.js";

describe("ValueStore", () => {
    it("keeps a number with its status and timestamps, and counts versions", () => {
        const values = new ValueStore(4);
        values.ensure(10);
        should(values.kind(3)).eql(ValueKind.None);
        should(values.version(3)).eql(0);
        values.setScalar(3, DataType.Double, 21.5, 0, 1000, 1001, 7, 8);
        should(values.get(3)).eql({
            kind: ValueKind.Number,
            dataType: DataType.Double,
            value: 21.5,
            statusCode: 0,
            sourceTimestamp: 1000,
            sourcePicoseconds: 7,
            serverTimestamp: 1001,
            serverPicoseconds: 8
        });
        should(values.version(3)).eql(2, "one write is two increments, even at rest");
        values.touch(3, 2000, 2001);
        should(values.version(3)).eql(4);
        should(values.sourceTimestamp(3)).eql(2000);
        should(values.number(3)).eql(21.5);
    });

    it("keeps a boolean as a boolean", () => {
        const values = new ValueStore();
        values.setScalar(0, DataType.Boolean, true, 0, 1, 1);
        should(values.get(0).value).eql(true);
        should(values.kind(0)).eql(ValueKind.Boolean);
        values.setScalar(0, DataType.Boolean, false, 0, 2, 2);
        should(values.get(0).value).eql(false);
    });

    it("keeps anything else in the side table, and only there", () => {
        const values = new ValueStore();
        values.setObject(1, DataType.String, "hello", 0, 1, 1);
        values.setObject(2, DataType.Int32, new Int32Array([1, 2, 3]), 0, 1, 1);
        should(values.objectCount).eql(2);
        should(values.get(1).value).eql("hello");
        should(values.get(1).kind).eql(ValueKind.Object);
        should([...(values.get(2).value as Int32Array)]).eql([1, 2, 3]);
        values.setScalar(1, DataType.Double, 1, 0, 2, 2);
        should(values.objectCount).eql(1, "a scalar written over an object frees the side table entry");
        values.clear(2);
        should(values.objectCount).eql(0);
        should(values.get(2).kind).eql(ValueKind.None);
    });

    it("keeps a status alone", () => {
        const values = new ValueStore();
        values.setStatus(5, 0x80320000, 123);
        const v = values.get(5);
        should(v.kind).eql(ValueKind.None);
        should(v.statusCode).eql(0x80320000);
        should(v.serverTimestamp).eql(123);
        should(v.value).eql(undefined);
    });

    it("grows and compacts without losing values", () => {
        const values = new ValueStore(4);
        for (let i = 0; i < 1000; i++) {
            values.ensure(i + 1);
            values.setScalar(i, DataType.Double, i / 2, 0, i, i);
        }
        values.compact(1000);
        should(values.capacity).eql(1000);
        should(values.number(999)).eql(499.5);
        should(values.version(500)).eql(2);
    });
});
