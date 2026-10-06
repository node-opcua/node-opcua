import { readFileSync } from "node:fs";
import type { ISessionContext } from "node-opcua-address-space-base";
import { StoreAddressSpace, type StoreMethodView, StoreServices } from "node-opcua-address-space-store";
import { WellKnownRoles } from "node-opcua-constants";
import { AttributeIds } from "node-opcua-data-model";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodRequest, MessageSecurityMode, PermissionType } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { compactRecordConsumer } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";

/** a session context reduced to what the store checks: the channel's mode and the roles */
function session(roles: NodeId[]): ISessionContext {
    return {
        session: { channel: { securityMode: MessageSecurityMode.None } },
        getCurrentUserRoles: () => roles
    } as unknown as ISessionContext;
}

describe("store methods: Call on a Method of the compact address space", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let services: StoreServices;
    let ns: number;
    let pump: NodeId;
    let start: NodeId;
    let stop: NodeId;
    const calls: { inputs: Variant[]; context: ISessionContext | null; objectId: NodeId }[] = [];

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192 });
        const consumer = compactRecordConsumer(space);
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        consumer.finish();
        ns = space.registerNamespace("urn:test:methods");
        services = new StoreServices(space);
        const objects = space.findNode("ns=0;i=85");
        pump = space.addObject({ nodeId: `ns=${ns};s=Pump`, browseName: "Pump", organizedBy: objects ?? undefined }).nodeId;
        start = space.addMethod({
            nodeId: `ns=${ns};s=Pump.Start`,
            browseName: "Start",
            componentOf: pump,
            inputArguments: [{ name: "speed", dataType: resolveNodeId("Double"), valueRank: -1 }],
            outputArguments: [{ name: "running", dataType: resolveNodeId("Boolean"), valueRank: -1 }]
        }).nodeId;
        stop = space.addMethod({
            nodeId: `ns=${ns};s=Pump.Stop`,
            browseName: "Stop",
            componentOf: pump,
            // the Operators may call it, nobody else
            rolePermissions: [
                { roleId: resolveNodeId(WellKnownRoles.Operator), permissions: PermissionType.Browse | PermissionType.Call }
            ]
        }).nodeId;
    });

    const call = (objectId: NodeId, methodId: NodeId, inputs: Variant[], context: ISessionContext | null = null) =>
        services.call(context, new CallMethodRequest({ objectId, methodId, inputArguments: inputs }));
    const speed = (value: number) => new Variant({ dataType: DataType.Double, value });

    it("is not executable until a function is bound to it", async () => {
        const executable = services.read(null, { nodeId: start, attributeId: AttributeIds.Executable }, 0);
        should(executable.value.value).eql(false);
        const result = await call(pump, start, [speed(10)]);
        should(result.statusCode).eql(StatusCodes.BadNotExecutable);
    });

    it("runs the bound function with the arguments, the context and the object", async () => {
        const method = space.findNode(start) as StoreMethodView;
        method.bindMethod((inputs: Variant[], context: ISessionContext | null, objectId: NodeId) => {
            calls.push({ inputs, context, objectId });
            return { outputArguments: [{ dataType: DataType.Boolean, value: (inputs[0].value as number) > 0 }] };
        });
        should(services.read(null, { nodeId: start, attributeId: AttributeIds.Executable }, 0).value.value).eql(true);
        const context = session([resolveNodeId(WellKnownRoles.Anonymous)]);
        const result = await call(pump, start, [speed(10)], context);
        should(result.statusCode).eql(StatusCodes.Good);
        should(result.outputArguments?.map((v) => (v as Variant).value)).eql([true]);
        should(result.inputArgumentResults).eql([StatusCodes.Good]);
        should(calls.length).eql(1);
        should(calls[0].context).equal(context);
        should(calls[0].objectId.toString()).eql(pump.toString());
    });

    it("checks the arguments against InputArguments", async () => {
        should((await call(pump, start, [])).statusCode).eql(StatusCodes.BadArgumentsMissing);
        should((await call(pump, start, [speed(1), speed(2)])).statusCode).eql(StatusCodes.BadTooManyArguments);
        const wrong = await call(pump, start, [new Variant({ dataType: DataType.String, value: "fast" })]);
        should(wrong.statusCode).eql(StatusCodes.BadInvalidArgument);
        should(wrong.inputArgumentResults).eql([StatusCodes.BadTypeMismatch]);
        should(calls.length).eql(1, "the function does not run on bad arguments");
    });

    it("refuses a Method that is not one of the object, and an object that is not one", async () => {
        const other = space.addObject({ nodeId: `ns=${ns};s=Valve`, browseName: "Valve", organizedBy: "ns=0;i=85" }).nodeId;
        should((await call(other, start, [speed(1)])).statusCode).eql(StatusCodes.BadMethodInvalid);
        should((await call(resolveNodeId(`ns=${ns};s=Nope`), start, [speed(1)])).statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should((await call(pump, resolveNodeId(`ns=${ns};s=Nope`), [])).statusCode).eql(StatusCodes.BadMethodInvalid);
        should((await call(start, start, [speed(1)])).statusCode).eql(StatusCodes.BadNodeIdInvalid);
    });

    it("applies the role permissions of the Method", async () => {
        (space.findNode(stop) as StoreMethodView).bindMethod(() => ({}));
        const anonymous = session([resolveNodeId(WellKnownRoles.Anonymous)]);
        const operator = session([resolveNodeId(WellKnownRoles.Operator)]);
        should((await call(pump, stop, [], anonymous)).statusCode).eql(StatusCodes.BadUserAccessDenied);
        should((await call(pump, stop, [], operator)).statusCode).eql(StatusCodes.Good);
    });

    it("answers BadInternalError when the function throws", async () => {
        const failing = space.addMethod({ browseName: "Fail", componentOf: pump });
        failing.bindMethod(() => {
            throw new Error("broken");
        });
        should((await call(pump, failing.nodeId, [])).statusCode).eql(StatusCodes.BadInternalError);
    });
});
