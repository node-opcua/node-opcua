import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { NumericRange } from "node-opcua-numeric-range";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, PseudoSession, SessionContext, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

const context = SessionContext.defaultContext;

describe("the index range of a partial write reaches the setter of a Variable", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/SetterIndexRange/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    const array = (values: number[]) =>
        new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: new Float64Array(values) });
    const make = (browseName: string, value: unknown) => {
        const variable = addressSpace.getOwnNamespace().addVariable({
            browseName,
            dataType: "Double",
            valueRank: 1,
            arrayDimensions: [5],
            organizedBy: addressSpace.rootFolder.objects,
            value
        } as never) as UAVariable;
        variable.readValue(context); // the getter fills in the stored array
        return variable;
    };
    const partial = () => new DataValue({ value: array([20, 30]) });

    it("IR-1 a callback-style set(value, callback, context, indexRange) receives the range of a partial write", async () => {
        let seen: { indexRange?: NumericRange | null; length?: number } = {};
        const variable = make("CallbackSetter", {
            get: () => array([1, 2, 3, 4, 5]),
            set: (
                value: Variant,
                callback: (err: Error | null, statusCode?: typeof StatusCodes.Good) => void,
                _context?: unknown,
                indexRange?: NumericRange | null
            ) => {
                seen = { indexRange, length: value.value.length };
                callback(null, StatusCodes.Good);
            }
        });
        should(await variable.writeValue(context, partial(), new NumericRange("1:2"))).eql(StatusCodes.Good);
        should(seen.indexRange?.toString()).eql("1:2");
        should(seen.length).eql(2);
    });

    it("IR-2 a callback-style timestamped_set(dataValue, callback, context, indexRange) receives the range", async () => {
        let seen: NumericRange | null | undefined;
        const variable = make("CallbackTimestampedSetter", {
            timestamped_get: () => new DataValue({ value: array([1, 2, 3, 4, 5]) }),
            timestamped_set: (
                _dataValue: DataValue,
                callback: (err: Error | null, statusCode?: typeof StatusCodes.Good) => void,
                _context?: unknown,
                indexRange?: NumericRange | null
            ) => {
                seen = indexRange;
                callback(null, StatusCodes.Good);
            }
        });
        should(await variable.writeValue(context, partial(), new NumericRange("3:4"))).eql(StatusCodes.Good);
        should(seen?.toString()).eql("3:4");
    });

    it("IR-3 timestamped_set_ctx(dataValue, { indexRange }) receives the range, through a PseudoSession too", async () => {
        const seen: (string | undefined)[] = [];
        const variable = make("ContextSetter", {
            timestamped_get: () => new DataValue({ value: array([1, 2, 3, 4, 5]) }),
            timestamped_set_ctx: async (_dataValue: DataValue, { indexRange }: { indexRange?: NumericRange | null }) => {
                seen.push(indexRange?.toString());
                return StatusCodes.Good;
            }
        });
        should(await variable.writeValue(context, partial(), new NumericRange("0:1"))).eql(StatusCodes.Good);
        const statusCode = await new PseudoSession(addressSpace, context).write({
            nodeId: variable.nodeId,
            attributeId: AttributeIds.Value,
            indexRange: new NumericRange("2:3"),
            value: new DataValue({ value: array([7, 8]) })
        });
        should(statusCode).eql(StatusCodes.Good);
        should(seen).eql(["0:1", "2:3"]);
    });

    it("IR-4 a write of the whole value gives an empty range, or none", async () => {
        const seen: (boolean | undefined)[] = [];
        const variable = make("WholeValue", {
            timestamped_get: () => new DataValue({ value: array([1, 2, 3, 4, 5]) }),
            timestamped_set_ctx: async (_dataValue: DataValue, { indexRange }: { indexRange?: NumericRange | null }) => {
                seen.push(indexRange ? indexRange.isEmpty() : undefined);
                return StatusCodes.Good;
            }
        });
        should(await variable.writeValue(context, new DataValue({ value: array([9, 9, 9, 9, 9]) }))).eql(StatusCodes.Good);
        should(seen.length).eql(1);
        should(seen[0] === undefined || seen[0] === true).eql(true);
    });
});
