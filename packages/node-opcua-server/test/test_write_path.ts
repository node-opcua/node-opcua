import {
    type AddressSpace,
    mayHoldOpaqueStructure,
    type Namespace,
    SessionContext,
    type UAVariable
} from "node-opcua-address-space";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { WriteValue } from "node-opcua-service-write";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source/index.js";

/**
 * A Write runs its nodes in order, each once the previous one is done, whether a node's setter
 * answers before writeAttribute returns or later; only the later ones are awaited.
 */
describe("Write - nodes written in order, synchronous ones without a promise each", function (this: Mocha.Suite) {
    let engine: ServerEngine;
    let namespace: Namespace;
    const journal: string[] = [];
    let plain: UAVariable;
    let syncSetter: UAVariable;
    let asyncSetter: UAVariable;
    let failingSetter: UAVariable;
    const context = SessionContext.defaultContext;

    before((done) => {
        engine = new ServerEngine({ applicationUri: "urn:test:write-path" });
        engine.initialize({ nodeset_filename: nodesets.standard }, () => {
            namespace = (engine.addressSpace as AddressSpace).getOwnNamespace() as Namespace;
            const add = (browseName: string, value: unknown) =>
                namespace.addVariable({
                    browseName,
                    dataType: DataType.Int32,
                    accessLevel: "CurrentRead | CurrentWrite",
                    userAccessLevel: "CurrentRead | CurrentWrite",
                    value: value as Variant
                });
            plain = add("WP_Plain", new Variant({ dataType: DataType.Int32, value: 0 }));
            let s = new Variant({ dataType: DataType.Int32, value: 0 });
            syncSetter = add("WP_Sync", {
                get: () => s,
                set: (v: Variant) => {
                    journal.push(`sync ${v.value}`);
                    s = v;
                    return StatusCodes.Good;
                }
            });
            let a = new Variant({ dataType: DataType.Int32, value: 0 });
            asyncSetter = add("WP_Async", {
                get: () => a,
                set: (v: Variant, callback: (err: Error | null, statusCode?: StatusCode) => void) => {
                    setTimeout(() => {
                        journal.push(`async ${v.value}`);
                        a = v;
                        callback(null, StatusCodes.Good);
                    }, 5);
                }
            });
            failingSetter = add("WP_Failing", {
                get: () => new Variant({ dataType: DataType.Int32, value: 0 }),
                set: (_v: Variant, callback: (err: Error | null, statusCode?: StatusCode) => void) => {
                    setTimeout(() => callback(new Error("setter failed")), 1);
                }
            });
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });
    beforeEach(() => {
        journal.length = 0;
    });

    const writeValue = (node: UAVariable, value: number) =>
        new WriteValue({
            nodeId: node.nodeId,
            attributeId: AttributeIds.Value,
            value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value }) })
        });

    it("WP-1 writes plain values and synchronous setters, in order", async () => {
        const results = await engine.write(context, [writeValue(plain, 1), writeValue(syncSetter, 2), writeValue(plain, 3)]);
        should(results).eql([StatusCodes.Good, StatusCodes.Good, StatusCodes.Good]);
        should(plain.readValue().value.value).eql(3);
        should(journal).eql(["sync 2"]);
    });

    it("WP-2 a setter that answers later holds the next nodes back until it has", async () => {
        const results = await engine.write(context, [
            writeValue(syncSetter, 1),
            writeValue(asyncSetter, 2),
            writeValue(syncSetter, 3),
            writeValue(asyncSetter, 4),
            writeValue(syncSetter, 5)
        ]);
        should(results).eql([StatusCodes.Good, StatusCodes.Good, StatusCodes.Good, StatusCodes.Good, StatusCodes.Good]);
        should(journal).eql(["sync 1", "async 2", "sync 3", "async 4", "sync 5"]);
    });

    it("WP-3 a node that is not there answers BadNodeIdUnknown, the others are written", async () => {
        const missing = new WriteValue({
            nodeId: "ns=1;s=WP_Missing",
            attributeId: AttributeIds.Value,
            value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value: 1 }) })
        });
        const results = await engine.write(context, [missing, writeValue(syncSetter, 7)]);
        should(results).eql([StatusCodes.BadNodeIdUnknown, StatusCodes.Good]);
        should(journal).eql(["sync 7"]);
    });

    it("WP-4 a setter that fails later rejects the Write, as before", async () => {
        await should(engine.write(context, [writeValue(syncSetter, 1), writeValue(failingSetter, 2)])).be.rejectedWith(
            "setter failed"
        );
        should(journal).eql(["sync 1"]);
    });

    it("WP-5 only an ExtensionObject or a nested Variant may hold an opaque structure to resolve", () => {
        should(mayHoldOpaqueStructure(new Variant({ dataType: DataType.Int32, value: 1 }))).eql(false);
        should(mayHoldOpaqueStructure(new Variant({ dataType: DataType.String, value: "x" }))).eql(false);
        should(
            mayHoldOpaqueStructure(new Variant({ dataType: DataType.Int32, arrayType: VariantArrayType.Array, value: [1, 2] }))
        ).eql(false);
        should(mayHoldOpaqueStructure(new Variant({ dataType: DataType.ExtensionObject, value: null }))).eql(true);
        should(
            mayHoldOpaqueStructure(
                new Variant({ dataType: DataType.Variant, arrayType: VariantArrayType.Array, value: [new Variant()] })
            )
        ).eql(true);
        should(mayHoldOpaqueStructure(null)).eql(false);
    });
});
