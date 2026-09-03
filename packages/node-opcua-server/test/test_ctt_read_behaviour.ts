import { SessionContext, type UAVariable } from "node-opcua-address-space";
import { AttributeIds } from "node-opcua-basic-types";
import { VariableIds } from "node-opcua-constants";
import { type DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { makeNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { ReadRequest } from "node-opcua-service-read";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../dist/index.js";

const buildInfo = {
    manufacturerName: "<Manufacturer>",
    productName: "NODEOPCUA-SERVER",
    productUri: "URI:NODEOPCUA-SERVER",
    softwareVersion: "1.0"
};

async function makeEngine(operationLimits?: Record<string, number>): Promise<ServerEngine> {
    const engine = new ServerEngine({ applicationUri: "URI:NODEOPCUA-SERVER", buildInfo, serverCapabilities: { operationLimits } });
    await new Promise<void>((resolve) => engine.initialize({ nodeset_filename: nodesets.standard }, resolve));
    return engine;
}

describe("Read behaviour checked by the CTT", function () {
    this.timeout(60_000);
    const context = SessionContext.defaultContext;

    describe("ServerTimestamp and MaxAge (CTT Attribute Read 006, 018, 023)", () => {
        let engine: ServerEngine;
        let variable: UAVariable;
        before(async () => {
            engine = await makeEngine();
            const namespace = engine.addressSpace!.getOwnNamespace();
            variable = namespace.addVariable({
                browseName: "Static",
                dataType: "Int32",
                organizedBy: engine.addressSpace!.rootFolder.objects
            });
            variable.setValueFromSource(new Variant({ dataType: DataType.Int32, value: 42 }));
            // pretend the value was set a minute ago
            const cached = (variable as unknown as { $dataValue: DataValue }).$dataValue;
            cached.serverTimestamp = new Date(Date.now() - 60_000);
            cached.sourceTimestamp = new Date(Date.now() - 60_000);
        });
        after(async () => engine.shutdown());

        const read = async (maxAge: number, timestampsToReturn = TimestampsToReturn.Both) => {
            const [dv] = await engine.read(
                context,
                new ReadRequest({
                    maxAge,
                    timestampsToReturn,
                    nodesToRead: [{ nodeId: variable.nodeId, attributeId: AttributeIds.Value }]
                })
            );
            return dv;
        };

        it("refreshes the ServerTimestamp of a cached value older than MaxAge", async () => {
            const dv = await read(10_000);
            should(Date.now() - dv.serverTimestamp!.getTime()).be.lessThan(10_000);
            // the SourceTimestamp is the source's business and stays as it was
            should(Date.now() - dv.sourceTimestamp!.getTime()).be.greaterThan(50_000);
        });
        it("keeps the ServerTimestamp of a value younger than MaxAge", async () => {
            const cached = (variable as unknown as { $dataValue: DataValue }).$dataValue;
            cached.serverTimestamp = new Date(Date.now() - 500);
            const dv = await read(10_000);
            should(Date.now() - dv.serverTimestamp!.getTime()).be.greaterThan(400);
        });
        it("keeps the cached ServerTimestamp when MaxAge asks for the cached value", async () => {
            const cached = (variable as unknown as { $dataValue: DataValue }).$dataValue;
            cached.serverTimestamp = new Date(Date.now() - 60_000);
            const dv = await read(0x7fffffff);
            should(Date.now() - dv.serverTimestamp!.getTime()).be.greaterThan(50_000);
        });
        it("returns no ServerTimestamp when only the Source one is requested (CTT Attribute Read 007)", async () => {
            const dv = await read(0, TimestampsToReturn.Source);
            should(dv.serverTimestamp).eql(null);
            should(dv.sourceTimestamp).be.instanceOf(Date);
        });
        it("answers BadDataEncodingInvalid with timestamps for a DataEncoding on a non-Structure value (CTT Attribute Read 037)", async () => {
            const [dv] = await engine.read(
                context,
                new ReadRequest({
                    maxAge: 0,
                    timestampsToReturn: TimestampsToReturn.Both,
                    nodesToRead: [
                        {
                            nodeId: variable.nodeId,
                            attributeId: AttributeIds.Value,
                            dataEncoding: { namespaceIndex: 0, name: "Modbus" }
                        }
                    ]
                })
            );
            // Part 4 Table 51: no encoding applies to a non-Structure value; the CTT still
            // wants the requested timestamps on that Bad result
            dv.statusCode.name.should.eql("BadDataEncodingInvalid");
            should(dv.sourceTimestamp).be.instanceOf(Date);
            should(dv.serverTimestamp).be.instanceOf(Date);
        });
    });

    describe("OperationLimits (CTT 1.05 Base Info Server Capabilities 2 015)", () => {
        it("does not expose a limit property whose value would be 0", async () => {
            const engine = await makeEngine({ maxNodesPerRead: 100, maxNodesPerTranslateBrowsePathsToNodeIds: 0 });
            try {
                const perRead = engine.addressSpace!.findNode(
                    makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead)
                ) as UAVariable;
                should.exist(perRead);
                perRead.readValue().value.value.should.eql(100);
                should.not.exist(
                    engine.addressSpace!.findNode(
                        makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerTranslateBrowsePathsToNodeIds)
                    )
                );
            } finally {
                await engine.shutdown();
            }
        });
    });
});
