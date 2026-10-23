import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type ISessionContext, PseudoSession, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { makeMockSessionContext } from "../testHelpers.js";

describe("the session context reaches the getters and setters of a Variable", () => {
    let addressSpace: AddressSpace;
    const contextOfAlice = makeMockSessionContext({ userName: "alice" });
    const contextOfBob = makeMockSessionContext({ userName: "bob" });

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("http://sterfive.com/UA/SessionContext/");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => {
        addressSpace.dispose();
    });

    const double = (value: number) => new Variant({ dataType: DataType.Double, value });
    const make = (browseName: string, value: unknown) =>
        addressSpace.getOwnNamespace().addVariable({
            browseName,
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects,
            value
        } as never) as UAVariable;

    describe("reads", () => {
        it("SC-1 refreshFunc(callback, context) receives the context of the reader", async () => {
            const seen: (ISessionContext | undefined)[] = [];
            const variable = make("RefreshFunc", {
                refreshFunc: (callback: (err: Error | null, dataValue?: DataValue) => void, context?: ISessionContext) => {
                    seen.push(context);
                    callback(null, new DataValue({ value: double(1) }));
                }
            });
            await variable.readValueAsync(contextOfAlice);
            await variable.readValueAsync(contextOfBob);
            should(seen[0]).equal(contextOfAlice);
            should(seen[1]).equal(contextOfBob);
        });

        it("SC-2 a callback-style timestamped_get(callback, context) receives the context of the reader", async () => {
            let seen: ISessionContext | undefined;
            const variable = make("CallbackGetter", {
                timestamped_get: (callback: (err: Error | null, dataValue?: DataValue) => void, context?: ISessionContext) => {
                    seen = context;
                    callback(null, new DataValue({ value: double(1) }));
                }
            });
            await variable.readValueAsync(contextOfBob);
            should(seen).equal(contextOfBob);
        });

        it("SC-3 timestamped_get_ctx({ context }) receives the context of the reader, through a PseudoSession too", async () => {
            const seen: (ISessionContext | undefined)[] = [];
            const variable = make("ContextGetter", {
                timestamped_get_ctx: async ({ context }: { context?: ISessionContext }) => {
                    seen.push(context);
                    return new DataValue({ value: double(5) });
                }
            });
            const dataValue = await variable.readValueAsync(contextOfAlice);
            should(dataValue.value.value).eql(5);
            await new PseudoSession(addressSpace, contextOfBob).read({ nodeId: variable.nodeId, attributeId: AttributeIds.Value });
            should(seen[0]).equal(contextOfAlice);
            should(seen[1]).equal(contextOfBob);
        });
    });

    describe("writes", () => {
        it("SC-4 a callback-style set(value, callback, context) receives the context of the writer", async () => {
            let seen: ISessionContext | undefined;
            const variable = make("CallbackSetter", {
                get: () => double(1),
                set: (
                    _value: Variant,
                    callback: (err: Error | null, statusCode?: typeof StatusCodes.Good) => void,
                    context?: ISessionContext
                ) => {
                    seen = context;
                    callback(null, StatusCodes.Good);
                }
            });
            should(await variable.writeValue(contextOfAlice, new DataValue({ value: double(2) }))).eql(StatusCodes.Good);
            should(seen).equal(contextOfAlice);
        });

        it("SC-5 a callback-style timestamped_set(dataValue, callback, context) receives the context of the writer", async () => {
            let seen: ISessionContext | undefined;
            const variable = make("CallbackTimestampedSetter", {
                timestamped_get: () => new DataValue({ value: double(1) }),
                timestamped_set: (
                    _dataValue: DataValue,
                    callback: (err: Error | null, statusCode?: typeof StatusCodes.Good) => void,
                    context?: ISessionContext
                ) => {
                    seen = context;
                    callback(null, StatusCodes.Good);
                }
            });
            should(await variable.writeValue(contextOfBob, new DataValue({ value: double(2) }))).eql(StatusCodes.Good);
            should(seen).equal(contextOfBob);
        });

        it("SC-6 timestamped_set_ctx(dataValue, { context }) receives the context of the writer, through a PseudoSession too", async () => {
            const seen: (ISessionContext | undefined)[] = [];
            const variable = make("ContextSetter", {
                timestamped_get: () => new DataValue({ value: double(1) }),
                timestamped_set_ctx: async (_dataValue: DataValue, { context }: { context?: ISessionContext }) => {
                    seen.push(context);
                    return StatusCodes.Good;
                }
            });
            should(await variable.writeValue(contextOfAlice, new DataValue({ value: double(2) }))).eql(StatusCodes.Good);
            const statusCode = await new PseudoSession(addressSpace, contextOfBob).write({
                nodeId: variable.nodeId,
                attributeId: AttributeIds.Value,
                value: { value: { dataType: DataType.Double, value: 3 } }
            });
            should(statusCode).eql(StatusCodes.Good);
            should(seen[0]).equal(contextOfAlice);
            should(seen[1]).equal(contextOfBob);
        });

        it("SC-7 a Promise-style timestamped_set still works, and is not given the context as an argument", async () => {
            let argumentCount = -1;
            const variable = make("PromiseSetter", {
                timestamped_get: () => new DataValue({ value: double(1) }),
                // biome-ignore lint/complexity/useArrowFunction: arguments is read on purpose
                timestamped_set: async function (this: UAVariable, _dataValue: DataValue) {
                    argumentCount = arguments.length;
                    return StatusCodes.Good;
                }
            });
            should(await variable.writeValue(contextOfAlice, new DataValue({ value: double(2) }))).eql(StatusCodes.Good);
            should(argumentCount).eql(1);
        });
    });
});
