import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { WriteValue } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { OPCUAServer } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

const port = 12151;

describe("OPCUAServer: a Write of Variables bound to synchronous setters", function () {
    this.timeout(60000);
    let server: OPCUAServer;

    before(async () => {
        server = new OPCUAServer({
            port,
            serverCertificateManager: await createServerCertificateManager(port),
            nodeset_filename: [nodesets.standard]
        });
        await server.initialize();
    });
    after(async () => {
        await server.shutdown();
    });

    it("looks up the permissions of the namespace once for the whole request, not once per value", async () => {
        const addressSpace = server.engine.addressSpace;
        if (!addressSpace) throw new Error("no address space");
        const namespace = addressSpace.getOwnNamespace();
        const written: number[] = [];
        for (let k = 0; k < 5; k++) {
            namespace.addVariable({
                nodeId: `s=Setter${k}`,
                browseName: `Setter${k}`,
                organizedBy: addressSpace.rootFolder.objects,
                dataType: "Double",
                value: {
                    get: () => new Variant({ dataType: DataType.Double, value: 0 }),
                    set: (value: Variant) => {
                        written.push(value.value as number);
                        return StatusCodes.Good;
                    }
                }
            });
        }
        const session = server.engine.createSession({ sessionTimeout: 10000 });
        let lookups = 0;
        const getDefaultRolePermissions = namespace.getDefaultRolePermissions.bind(namespace);
        namespace.getDefaultRolePermissions = () => {
            lookups++;
            return getDefaultRolePermissions();
        };
        const nodesToWrite = Array.from(
            { length: 5 },
            (_, k) =>
                new WriteValue({
                    nodeId: `ns=1;s=Setter${k}`,
                    attributeId: AttributeIds.Value,
                    value: new DataValue({ value: new Variant({ dataType: DataType.Double, value: k }) })
                })
        );
        const results = await server.engine.write(session.sessionContext, nodesToWrite);
        should(results.map((statusCode) => statusCode.name)).eql(["Good", "Good", "Good", "Good", "Good"]);
        should(written).eql([0, 1, 2, 3, 4]);
        // each setter answers at once: the five writes run under one permission cache
        should(lookups).eql(1);
    });
});
