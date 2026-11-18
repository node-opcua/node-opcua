import { fileURLToPath } from "node:url";
import { type ClientSession, OPCUAClient } from "node-opcua-client";
import { AttributeIds, PermissionFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { FrontThreadEngine } from "../dist/index.js";

// the fronts of this engine listen on consecutive ports, from the one it is given
const port = 5871;

/**
 * The fronts of a FrontThreadEngine serve the node objects of the engine from the shared store. An
 * application can restrict such a node on the node object (setRolePermissions) after the model is
 * loaded and before the fronts start: a session that the rule refuses must get the same answer from
 * a front as from the engine.
 */
describe("FrontThreadEngine: a node object restricted before the fronts start", function (this: Mocha.Suite) {
    this.timeout(120000);
    let engine: FrontThreadEngine;
    let client: OPCUAClient;
    let session: ClientSession;
    // a Variable of an application nodeset that declares no permission rule
    const appNodeset = fileURLToPath(new URL("./fixtures/front_mirrored_rules_nodeset.xml", import.meta.url));
    let nodeId: string;
    let openNodeId: string;

    before(async () => {
        engine = await FrontThreadEngine.create({
            nodesets: [nodesets.standard, appNodeset],
            serverCapabilities: { minSupportedSampleRate: 0 }
        });
        // the engine needs a namespace of its own before the fronts start
        engine.registerNamespace("urn:test:front-mirrored-rules:own");
        const ns = engine.serverEngine.addressSpace?.getNamespaceIndex("urn:test:front-mirrored-rules");
        nodeId = `ns=${ns};i=1001`;
        openNodeId = `ns=${ns};i=1002`;
        const node = engine.serverEngine.addressSpace?.findNode(nodeId) as unknown as {
            setRolePermissions(rolePermissions: { roleId: unknown; permissions: number }[]): void;
            setValueFromSource(value: { dataType: DataType; value: number }): void;
        };
        node.setValueFromSource({ dataType: DataType.UInt32, value: 4242 });
        // the application restricts the node: Operators read and write it; anonymous sessions only browse it
        node.setRolePermissions([
            {
                roleId: resolveNodeId("ns=0;i=15680"),
                permissions: PermissionFlag.Browse | PermissionFlag.Read | PermissionFlag.Write
            },
            { roleId: resolveNodeId("ns=0;i=15644"), permissions: PermissionFlag.Browse }
        ]);
        await engine.start({
            fronts: 1,
            ownPorts: true,
            serverModule: new URL("./fixtures/front_threads_server_options.mjs", import.meta.url),
            serverModuleData: { port }
        });
        client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(`opc.tcp://localhost:${port}`);
        session = await client.createSession();
    });

    after(async () => {
        await session?.close();
        await client?.disconnect();
        await engine?.shutdown();
    });

    it("FMR-1 refuses the value to an anonymous session, as the engine does", async () => {
        // control: the engine's own read for an anonymous session
        const value = await session.read({ nodeId, attributeId: AttributeIds.Value });
        should(value.statusCode).eql(StatusCodes.BadUserAccessDenied);
        should(value.value.value).not.eql(4242);
    });

    it("FMR-2 refuses a write by an anonymous session", async () => {
        const status = await session.write({
            nodeId,
            attributeId: AttributeIds.Value,
            value: new DataValue({ value: new Variant({ dataType: DataType.UInt32, value: 7 }) })
        });
        should(status).eql(StatusCodes.BadUserAccessDenied);
    });

    it("FMR-3 serves a node that no rule restricts", async () => {
        const value = await session.read({ nodeId: openNodeId, attributeId: AttributeIds.Value });
        should(value.statusCode).eql(StatusCodes.Good);
        should(value.value.value).eql(17);
    });

    it("FMR-4 applies a rule that the application sets after the fronts start", async () => {
        const node = engine.serverEngine.addressSpace?.findNode(openNodeId) as unknown as {
            setRolePermissions(rolePermissions: { roleId: unknown; permissions: number }[]): void;
        };
        node.setRolePermissions([{ roleId: resolveNodeId("ns=0;i=15644"), permissions: PermissionFlag.Browse }]);
        const value = await session.read({ nodeId: openNodeId, attributeId: AttributeIds.Value });
        should(value.statusCode).eql(StatusCodes.BadUserAccessDenied);
    });
});
