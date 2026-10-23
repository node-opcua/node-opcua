import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, SessionContext, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

const context = SessionContext.defaultContext;

describe("the synchronous read of a Variable with an asynchronous getter", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/AsyncGetter/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    function makeVariable(browseName: string, kind: "async" | "sync") {
        const calls = { count: 0 };
        const namespace = addressSpace.getOwnNamespace();
        const dataValue = () => {
            calls.count++;
            return new DataValue({ value: new Variant({ dataType: DataType.Double, value: 7 }) });
        };
        const variable = namespace.addVariable({
            browseName,
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects,
            value: { timestamped_get: kind === "async" ? async () => dataValue() : () => dataValue() }
        } as never) as UAVariable;
        calls.count = 0; // binding probes the getter once
        return { variable, calls };
    }

    // a value newer than anything held: asking for the same millisecond could be answered from the held one
    const refresh = (variable: UAVariable) =>
        new Promise<void>((resolve, reject) =>
            variable.asyncRefresh({ timestamp: new Date(Date.now() + 1000), picoseconds: 0 }, (err: Error | null) =>
                err ? reject(err) : resolve()
            )
        );

    it("AG-1 readValue does not call an asynchronous getter, it serves the held value", () => {
        const { variable, calls } = makeVariable("AsyncRead", "async");
        variable.readValue(context);
        should(calls.count).eql(0);
    });

    it("AG-2 a Read (refresh, then readValue) calls an asynchronous getter once", async () => {
        const { variable, calls } = makeVariable("AsyncRefreshThenRead", "async");
        await refresh(variable);
        const dataValue = variable.readValue(context);
        should(calls.count).eql(1);
        should(dataValue.statusCode).eql(StatusCodes.Good);
        should(dataValue.value.value).eql(7);
    });

    it("AG-3 readValueAsync calls an asynchronous getter once", async () => {
        const { variable, calls } = makeVariable("AsyncReadAsync", "async");
        const dataValue = await variable.readValueAsync(context);
        should(calls.count).eql(1);
        should(dataValue.value.value).eql(7);
    });

    it("AG-4 readValue still calls a synchronous getter, as it must to answer", () => {
        const { variable, calls } = makeVariable("SyncRead", "sync");
        const dataValue = variable.readValue(context);
        should(calls.count).eql(1);
        should(dataValue.value.value).eql(7);
    });
});
