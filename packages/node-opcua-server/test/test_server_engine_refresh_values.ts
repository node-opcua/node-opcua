import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
import type { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { ReadValueId } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source/index.js";

describe("ServerEngine - refreshValues", () => {
    let engine: ServerEngine;
    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: get_mini_nodeset_filename() }, () => {
            const namespace = engine.addressSpace?.getOwnNamespace();
            if (!namespace) {
                throw new Error("addressSpace is null");
            }
            const addVariable = (name: string, value: Parameters<typeof namespace.addVariable>[0]["value"]) =>
                namespace.addVariable({
                    browseName: name,
                    nodeId: `s=${name}`,
                    dataType: "Double",
                    minimumSamplingInterval: 1000,
                    value
                });

            addVariable("SyncGetter1", { get: () => new Variant({ dataType: DataType.Double, value: 1 }) });
            addVariable("SyncGetter2", { get: () => new Variant({ dataType: DataType.Double, value: 2 }) });
            addVariable("AsyncRefresh", {
                refreshFunc: (callback: (err: Error | null, dataValue?: DataValue) => void) => {
                    setImmediate(() => callback(null, { value: { dataType: DataType.Double, value: 3 } } as unknown as DataValue));
                }
            });
            addVariable("FailingRefresh", {
                refreshFunc: (callback: (err: Error | null, dataValue?: DataValue) => void) => {
                    setImmediate(() => callback(new Error("refresh failed")));
                }
            });
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    const nodesToRefresh = (...names: string[]) => names.map((name) => new ReadValueId({ nodeId: `ns=1;s=${name}` }));

    it("answers before returning when every Variable has a synchronous getter", () => {
        let values: DataValue[] | undefined;
        engine.refreshValues(nodesToRefresh("SyncGetter1", "SyncGetter2"), 0, (err, dataValues) => {
            should(err).eql(null);
            values = dataValues;
        });
        should(values?.map((dataValue) => dataValue.value.value)).eql([1, 2]);
    });

    it("waits for the Variables that are refreshed asynchronously", async () => {
        let answered = false;
        const values = await new Promise<DataValue[] | undefined>((resolve, reject) => {
            engine.refreshValues(nodesToRefresh("SyncGetter1", "AsyncRefresh", "SyncGetter2"), 0, (err, dataValues) => {
                answered = true;
                err ? reject(err) : resolve(dataValues);
            });
            should(answered).eql(false);
        });
        should(values?.map((dataValue) => dataValue.value.value)).eql([1, 3, 2]);
    });

    it("reports a failed refresh, once", async () => {
        let answers = 0;
        const err = await new Promise<Error | null>((resolve) => {
            engine.refreshValues(nodesToRefresh("SyncGetter1", "FailingRefresh", "AsyncRefresh"), 0, (err) => {
                answers += 1;
                resolve(err);
            });
        });
        should(err?.message).eql("refresh failed");
        await new Promise((resolve) => setTimeout(resolve, 20));
        should(answers).eql(1);
    });

    it("an exception thrown by the callback reaches the caller", () => {
        should(() => {
            engine.refreshValues(nodesToRefresh("SyncGetter1"), 0, () => {
                throw new Error("thrown by the callback");
            });
        }).throw("thrown by the callback");

        // and the Variable is left as it was
        let values: DataValue[] | undefined;
        engine.refreshValues(nodesToRefresh("SyncGetter1"), 0, (_err, dataValues) => {
            values = dataValues;
        });
        should(values?.[0].statusCode.isGood()).eql(true);
        should(values?.[0].value.value).eql(1);
    });
});
