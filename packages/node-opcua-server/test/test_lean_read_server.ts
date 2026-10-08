import { OPCUAClient } from "node-opcua-client";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import type { ReadValueIdOptions } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { OPCUAServer } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

const port = 12150;

describe("OPCUAServer: a Read of Values answered from the bytes of the request", function () {
    this.timeout(60000);
    let server: OPCUAServer;
    let client: OPCUAClient;
    let readHandlerCalls = 0;

    before(async () => {
        server = new OPCUAServer({
            port,
            serverCertificateManager: await createServerCertificateManager(port),
            nodeset_filename: [nodesets.standard]
        });
        await server.initialize();
        const namespace = server.engine.addressSpace?.getOwnNamespace();
        if (!namespace) throw new Error("no address space");
        const objects = server.engine.addressSpace?.rootFolder.objects;
        namespace.addVariable({
            nodeId: "s=Speed",
            browseName: "Speed",
            organizedBy: objects,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 3.5 }
        });
        namespace.addVariable({
            nodeId: "s=Unreadable",
            browseName: "Unreadable",
            organizedBy: objects,
            dataType: "Double",
            accessLevel: "CurrentWrite",
            userAccessLevel: "CurrentWrite",
            value: { dataType: DataType.Double, value: 1 }
        });
        namespace.addVariable({
            nodeId: "s=Refreshed",
            browseName: "Refreshed",
            organizedBy: objects,
            dataType: "Double",
            value: {
                refreshFunc: (callback: (err: Error | null, dataValue?: DataValue) => void) =>
                    setTimeout(
                        () => callback(null, new DataValue({ value: new Variant({ dataType: DataType.Double, value: 42 }) })),
                        10
                    )
            }
        });
        // the normal path goes through the Read handler; the lean one does not
        const target = server as unknown as { _on_ReadRequest: (...args: unknown[]) => void };
        const onReadRequest = target._on_ReadRequest;
        target._on_ReadRequest = function (...args: unknown[]) {
            readHandlerCalls++;
            return onReadRequest.apply(this, args);
        };
        await server.start();
        client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
        await client.connect(`opc.tcp://localhost:${port}`);
    });
    after(async () => {
        await client.disconnect();
        await server.shutdown();
    });

    const value = (id: string): ReadValueIdOptions => ({ nodeId: `ns=1;s=${id}`, attributeId: AttributeIds.Value });

    it("answers a Read of Variables read at once without the Read handler", async () => {
        const session = await client.createSession();
        try {
            readHandlerCalls = 0;
            const [speed] = await session.read([value("Speed")]);
            should(speed.statusCode).eql(StatusCodes.Good);
            should(speed.value.value).eql(3.5);
            should(readHandlerCalls).eql(0);
        } finally {
            await session.close();
        }
    });

    it("answers as the normal path does, permissions included", async () => {
        const session = await client.createSession();
        try {
            const items = [value("Speed"), value("Unreadable")];
            readHandlerCalls = 0;
            const lean = await session.read(items);
            should(readHandlerCalls).eql(0);
            // a listener of "request" makes every request go the normal way
            const listener = () => undefined;
            server.on("request", listener);
            try {
                const normal = await session.read(items);
                should(readHandlerCalls).eql(1);
                should(lean.map((d) => d.statusCode.name)).eql(normal.map((d) => d.statusCode.name));
                should(lean.map((d) => d.value.value)).eql(normal.map((d) => d.value.value));
            } finally {
                server.removeListener("request", listener);
            }
            should(lean[1].statusCode.isGood()).eql(false);
        } finally {
            await session.close();
        }
    });

    it("leaves to the Read handler an index range, a Variable refreshed before it is read, and an unknown node", async () => {
        const session = await client.createSession();
        try {
            readHandlerCalls = 0;
            const [refreshed] = await session.read([value("Refreshed")]);
            should(refreshed.value.value).eql(42);
            await session.read([{ ...value("Speed"), indexRange: "0" }]);
            const [missing] = await session.read([value("Missing")]);
            should(missing.statusCode).eql(StatusCodes.BadNodeIdUnknown);
            should(readHandlerCalls).eql(3);
        } finally {
            await session.close();
        }
    });
});
