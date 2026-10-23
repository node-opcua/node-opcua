import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, SessionContext, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

const context = SessionContext.defaultContext;

describe("a Variable write that its setter rejects does not change the stored value", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/WriteRejected/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    const double = (value: number) => new Variant({ dataType: DataType.Double, value });

    function makeVariable(
        browseName: string,
        bind: {
            set?: (variant: Variant) => Promise<StatusCode> | StatusCode;
            timestamped_set?: (dataValue: DataValue) => Promise<StatusCode>;
        }
    ) {
        const namespace = addressSpace.getOwnNamespace();
        const variable = namespace.addVariable({
            browseName,
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects,
            value: bind.set
                ? { get: () => double(1), set: bind.set }
                : { timestamped_get: () => new DataValue({ value: double(1) }), timestamped_set: bind.timestamped_set }
        } as never) as UAVariable;
        return variable;
    }

    async function writeThenInspect(variable: UAVariable) {
        const changes: number[] = [];
        variable.on("value_changed", (dataValue: DataValue) => changes.push(dataValue.value.value));
        const statusCode = await variable.writeValue(context, new DataValue({ value: double(42) }));
        return { statusCode, stored: variable.$dataValue.value.value, changes };
    }

    it("WR-1 an async setter answering Bad leaves the stored value as it was", async () => {
        const variable = makeVariable("AsyncBad", { timestamped_set: async (_dataValue: DataValue) => StatusCodes.BadOutOfRange });
        const r = await writeThenInspect(variable);
        should(r.statusCode).eql(StatusCodes.BadOutOfRange);
        should(r.changes).eql([]);
        should(r.stored).eql(1);
    });

    it("WR-2 a simple setter answering Bad leaves the stored value, and its status, as they were", async () => {
        const variable = makeVariable("SimpleBad", { set: (_variant: Variant) => StatusCodes.BadOutOfRange });
        const r = await writeThenInspect(variable);
        should(r.statusCode).eql(StatusCodes.BadOutOfRange);
        should(r.changes).eql([]);
        should(r.stored).eql(1);
        should(variable.$dataValue.statusCode.isGood()).eql(true);
    });

    it("WR-3 a setter answering Good still stores the value", async () => {
        const variable = makeVariable("AsyncGood", { timestamped_set: async (_dataValue: DataValue) => StatusCodes.Good });
        const r = await writeThenInspect(variable);
        should(r.statusCode).eql(StatusCodes.Good);
        should(r.changes).eql([42]);
        should(r.stored).eql(42);
    });
});
