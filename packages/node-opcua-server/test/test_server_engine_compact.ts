import { type CompactAddressSpace, SessionContext } from "node-opcua-address-space";
import { AttributeIds, BrowseDirection, NodeClass, ResultMask } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { ReadRequest, TimestampsToReturn } from "node-opcua-service-read";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { WriteValue } from "node-opcua-service-write";
import { StatusCodes } from "node-opcua-status-code";
import { BrowseDescription, CallMethodRequest } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../dist/server_engine.js";

describe("ServerEngine with a compact address space: Read, Write, Browse, Translate and Call on compact namespaces", function () {
    this.timeout(60000);
    let engine: ServerEngine;
    let compact: CompactAddressSpace;
    let ns: number;
    const context = SessionContext.defaultContext;
    let machineId = "";

    before((done) => {
        engine = new ServerEngine({ applicationUri: "urn:test:compact" });
        engine.initialize({ nodeset_filename: nodesets.standard, compactAddressSpace: true }, () => {
            compact = engine.compactAddressSpace as CompactAddressSpace;
            ns = engine.registerCompactNamespace("urn:test:compact:plant");
            const objects = compact.findNode("ns=0;i=85") as never;
            const plant = compact.addFolder(objects, "Plant");
            const machine = compact.addObject({ browseName: "Machine", organizedBy: plant });
            compact.addVariable({
                nodeId: `ns=${ns};s=Speed`,
                browseName: "Speed",
                componentOf: machine,
                dataType: "Double",
                value: { dataType: DataType.Double, value: 12.5 }
            });
            let reads = 0;
            compact.addVariable({
                nodeId: `ns=${ns};s=Counter`,
                browseName: "Counter",
                componentOf: machine,
                dataType: "UInt32",
                value: { get: () => new Variant({ dataType: DataType.UInt32, value: ++reads }) }
            });
            compact
                .addMethod({
                    nodeId: `ns=${ns};s=Machine.Double`,
                    browseName: "Double",
                    componentOf: machine,
                    inputArguments: [{ name: "x", dataType: resolveNodeId("Double"), valueRank: -1 }],
                    outputArguments: [{ name: "twice", dataType: resolveNodeId("Double"), valueRank: -1 }]
                })
                .bindMethod((inputs) => ({
                    outputArguments: [{ dataType: DataType.Double, value: 2 * (inputs[0].value as number) }]
                }));
            machineId = machine.nodeId.toString();
            done();
        });
    });
    after(async () => {
        await engine.shutdown();
    });

    it("registers the compact namespace on both tables, at the same index", () => {
        should(ns).eql(2, "after the UA namespace and the server's own");
        should(engine.addressSpace?.getNamespaceArray().map((n) => n.namespaceUri)).eql(compact.namespaceUris);
    });

    it("reads a compact node through the Read service, with the timestamps asked for", () => {
        const request = new ReadRequest({
            maxAge: 0,
            timestampsToReturn: TimestampsToReturn.Both,
            nodesToRead: [
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value },
                { nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.BrowseName },
                { nodeId: `ns=${ns};s=Counter`, attributeId: AttributeIds.Value },
                { nodeId: `ns=${ns};s=Nope`, attributeId: AttributeIds.Value },
                { nodeId: "ns=0;i=2256", attributeId: AttributeIds.BrowseName }
            ]
        });
        const values = engine.readSync(context, request);
        should(values[0].statusCode).eql(StatusCodes.Good);
        should(values[0].value.value).eql(12.5);
        should(values[0].sourceTimestamp).be.instanceOf(Date);
        should(values[0].serverTimestamp).be.instanceOf(Date);
        should(values[1].value.value.name).eql("Speed");
        should(values[2].value.value).eql(1, "the getter is read");
        should(values[3].statusCode).eql(StatusCodes.BadNodeIdUnknown);
        should(values[4].value.value.name).eql("ServerStatus", "the node objects still answer their namespaces");
    });

    it("calls a Method of the compact namespace through the Call service", async () => {
        const [result, wrong] = await engine.call(context, [
            new CallMethodRequest({
                objectId: machineId,
                methodId: `ns=${ns};s=Machine.Double`,
                inputArguments: [new Variant({ dataType: DataType.Double, value: 21 })]
            }),
            new CallMethodRequest({ objectId: machineId, methodId: `ns=${ns};s=Machine.Double`, inputArguments: [] })
        ]);
        should(result.statusCode).eql(StatusCodes.Good);
        should((result.outputArguments ?? [])[0]?.value).eql(42);
        should(wrong.statusCode).eql(StatusCodes.BadArgumentsMissing);
    });

    it("writes a compact node through the Write service", async () => {
        const write = (value: Variant) =>
            engine.write(context, [
                new WriteValue({ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value, value: new DataValue({ value }) })
            ]);
        should((await write(new Variant({ dataType: DataType.Double, value: 42 })))[0]).eql(StatusCodes.Good);
        should(
            engine.readSync(
                context,
                new ReadRequest({ nodesToRead: [{ nodeId: `ns=${ns};s=Speed`, attributeId: AttributeIds.Value }] })
            )[0].value.value
        ).eql(42);
        should((await write(new Variant({ dataType: DataType.String, value: "x" })))[0]).eql(StatusCodes.BadTypeMismatch);
    });

    it("browses from the Objects folder into the compact namespace, and on from there", async () => {
        const browse = (nodeId: string) =>
            engine.browse(context, [
                new BrowseDescription({
                    nodeId,
                    browseDirection: BrowseDirection.Forward,
                    referenceTypeId: "ns=0;i=33",
                    includeSubtypes: true,
                    nodeClassMask: 0,
                    resultMask: ResultMask.BrowseName | ResultMask.NodeClass | ResultMask.TypeDefinition | ResultMask.IsForward
                })
            ]);
        const objects = (await browse("ns=0;i=85"))[0];
        should(objects.statusCode).eql(StatusCodes.Good);
        const names = (objects.references ?? []).map((r) => r.browseName.toString());
        should(names).containEql("Server");
        should(names).containEql(`${ns}:Plant`);
        should(names.filter((n) => n === "Server").length).eql(1, "the base namespace references are not doubled");
        const plant = (objects.references ?? []).find((r) => r.browseName.name === "Plant");
        should(plant?.nodeClass).eql(NodeClass.Object);
        should(plant?.typeDefinition.toString()).eql("ns=0;i=61");

        const machines = (await browse(plant?.nodeId.toString() ?? ""))[0];
        should((machines.references ?? []).map((r) => r.browseName.toString())).eql([`${ns}:Machine`]);
        const machine = (await browse(machines.references?.[0].nodeId.toString() ?? ""))[0];
        should((machine.references ?? []).map((r) => r.browseName.name).sort()).eql(["Counter", "Double", "Speed"]);
    });

    it("translates a path from the Objects folder into the compact namespace", async () => {
        const result = await engine.translateBrowsePath(makeBrowsePath("ns=0;i=85", `/${ns}:Plant/${ns}:Machine/${ns}:Speed`));
        should(result.statusCode).eql(StatusCodes.Good);
        should(result.targets?.[0].targetId.toString()).eql(`ns=${ns};s=Speed`);
        const missing = await engine.translateBrowsePath(makeBrowsePath("ns=0;i=85", `/${ns}:Plant/${ns}:Nope`));
        should(missing.statusCode).eql(StatusCodes.BadNoMatch);
        const objectPath = await engine.translateBrowsePath(makeBrowsePath("ns=0;i=85", "/0:Server/0:ServerStatus"));
        should(objectPath.targets?.[0].targetId.toString()).eql("ns=0;i=2256");
    });
});
