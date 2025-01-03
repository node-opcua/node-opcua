import { OPCUAServer, nodesets } from "node-opcua";
import { AttributeIds, DataType, ExtensionObject, NodeId, OPCUAClient, readNamespaceArray } from "node-opcua-client";
import "should";

const port = 2244;

describe("client with DataType Manager regeneration", () => {
    let server: OPCUAServer | undefined;

    const nodeId = "ns=1;s=ScanResult";

    let startCount = 0;
    async function startServer() {

        // create a server that have the following property:
        //   - when the server restarts, the namespace indexes are arranged differently
        
        server = new OPCUAServer({
            port,
            nodeset_filename:
                startCount++ % 2 == 0
                    ? [nodesets.standard, nodesets.di, nodesets.adi, nodesets.autoId, nodesets.commercialKitchenEquipment]
                    : [nodesets.standard, nodesets.di, nodesets.autoId, nodesets.adi]
        });

        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();

        let counter = 1;
        function nextValue() {
            const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
            const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
            const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
                // ScanResult
                codeType: "Hello",
                scanData: {
                    epc: {
                        pC: 12 + counter,
                        uId: Buffer.from("Hello" + counter),
                        xpC_W1: 10,
                        xpC_W2: 12
                    }
                },
                timestamp: new Date(),
                location: {
                    local: {
                        x: 100 + counter,
                        y: 200 + counter,
                        z: 300 + counter,
                        timestamp: new Date(),
                        dilutionOfPrecision: 0.01,
                        usefulPrecision: 2
                    }
                }
            });
            return scanResult;
        }
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;

        const scanResultVariable = namespace.addVariable({
            browseName: "ScanResult",
            nodeId: "s=ScanResult",
            minimumSamplingInterval: 500,
            dataType: rfidScanResultDataTypeNode,
            componentOf: addressSpace.rootFolder.objects.server
        });

        const scanResult = nextValue();
        scanResultVariable.setValueFromSource({ dataType: DataType.ExtensionObject, value: scanResult });

        await server.start();

        return server;
    }
    async function stopServer() {
        if (server) {
            await server.shutdown(0);
            server = undefined;
        }
    }
    before(async () => {
        server = await startServer();
    });

    after(async () => {
        await stopServer();
    });

    it("should read scan results twice", async () => {
        const client = OPCUAClient.create({});
        const endpoint = server!.getEndpointUrl() || "";
        const [dv, namespaceArray] = await client.withSessionAsync(endpoint, async (session) => {
            const dv = await session.read([
                { nodeId, attributeId: AttributeIds.Value },
                { nodeId, attributeId: AttributeIds.DataType }
            ]);
            const namespaceArray = await readNamespaceArray(session);
            return [dv, namespaceArray];
        });
        client.transactionsPerformed.should.be.greaterThan(250);
        // console.log(dv.toString());
        const extObj = dv[0].value.value as ExtensionObject;
        const dataType = dv[1].value.value as NodeId;

        console.log(extObj.schema.dataTypeNodeId.toString());
        console.log(dataType.toString());
        console.log(namespaceArray);

        namespaceArray[4].should.equal("http://opcfoundation.org/UA/AutoID/");
        dataType.namespace.should.equal(4);
        dataType.value.should.equal(3007);
        dataType.toString().should.eql(extObj.schema.dataTypeNodeId.toString());
    });

    async function simulateConnectionBreak(client: OPCUAClient) {
        const socket = (client as any)._secureChannel.getTransport()._socket;
        socket.end();
        socket.emit("error", new Error("ECONNRESET"));
        await new Promise((resolve)=>setTimeout(resolve, 1000));
    }
    it("should read scan results twice : short break and automatic reconnection , cached dataTypeManager not reloaded", async () => {

        const client = OPCUAClient.create({});
        const endpoint = server!.getEndpointUrl() || "";
        const [dv1, namespaceArray1, transactionPerformed1, dv2, namespaceArray2, transactionPerformed2] =
            await client.withSessionAsync(endpoint, async (session) => {
                const dv1 = await session.read([
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.DataType }
                ]);
                const namespaceArray1 = await readNamespaceArray(session);
                const transactionPerformed1 = client.transactionsPerformed;
                console.log("sessionId before Reconnection", session.sessionId.toString());


                // simulate network outage
                await simulateConnectionBreak(client);

                // wait for reconnection
                await new Promise((resolve) => session.on("session_restored", resolve));
                console.log("sessionId after Reconnection", session.sessionId.toString());

                const dv2 = await session.read([
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.DataType }
                ]);
                const namespaceArray2 = await readNamespaceArray(session);
                const transactionPerformed2 = client.transactionsPerformed;

                return [dv1, namespaceArray1, transactionPerformed1, dv2, namespaceArray2, transactionPerformed2];
            });
        client.transactionsPerformed.should.be.greaterThan(250);
        {
            // console.log(dv1.toString());
            const extObj = dv1[0].value.value as ExtensionObject;
            const dataType = dv1[1].value.value as NodeId;

            console.log(extObj.schema.dataTypeNodeId.toString());
            console.log(dataType.toString());
            console.log(namespaceArray1);
            namespaceArray1[4].should.equal("http://opcfoundation.org/UA/AutoID/");
            dataType.namespace.should.equal(4);
            dataType.value.should.equal(3007);
            dataType.toString().should.eql(extObj.schema.dataTypeNodeId.toString());
        }
        {
            // console.log(dv2.toString());
            const extObj = dv2[0].value.value as ExtensionObject;
            const dataType = dv2[1].value.value as NodeId;

            console.log(extObj.schema.dataTypeNodeId.toString());
            console.log(dataType.toString());
            console.log(namespaceArray2);
            namespaceArray2[4].should.equal("http://opcfoundation.org/UA/AutoID/");
            dataType.namespace.should.equal(4);
            dataType.value.should.equal(3007);
            dataType.toString().should.eql(extObj.schema.dataTypeNodeId.toString());
        }
        
        (transactionPerformed2 - transactionPerformed1).should.be.lessThan(5);


    });
    it("should read scan results twice : server restarted and automatic reconnection , cached dataTypeManager automatically reloaded", async () => {
        const client = OPCUAClient.create({});
        const endpoint = server!.getEndpointUrl() || "";
        const [dv1, namespaceArray1, transactionPerformed1, dv2, namespaceArray2, transactionPerformed2] =
            await client.withSessionAsync(endpoint, async (session) => {
                const dv1 = await session.read([
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.DataType }
                ]);
                const namespaceArray1 = await readNamespaceArray(session);
                const transactionPerformed1 = client.transactionsPerformed;
                console.log("sessionId before Reconnection", session.sessionId.toString());
                await stopServer();
                await startServer();

                // wait for reconnection
                await new Promise((resolve) => session.on("session_restored", resolve));
                console.log("sessionId after Reconnection", session.sessionId.toString());

                const dv2 = await session.read([
                    { nodeId, attributeId: AttributeIds.Value },
                    { nodeId, attributeId: AttributeIds.DataType }
                ]);
                const namespaceArray2 = await readNamespaceArray(session);
                const transactionPerformed2 = client.transactionsPerformed;

                return [dv1, namespaceArray1, transactionPerformed1, dv2, namespaceArray2, transactionPerformed2];
            });
        client.transactionsPerformed.should.be.greaterThan(250);
        {
            // console.log(dv1.toString());
            const extObj = dv1[0].value.value as ExtensionObject;
            const dataType = dv1[1].value.value as NodeId;

            console.log(extObj.schema.dataTypeNodeId.toString());
            console.log(dataType.toString());
            console.log(namespaceArray1);
            namespaceArray1[4].should.equal("http://opcfoundation.org/UA/AutoID/");
            dataType.namespace.should.equal(4);
            dataType.value.should.equal(3007);
            dataType.toString().should.eql(extObj.schema.dataTypeNodeId.toString());
        }
        {
            // console.log(dv2.toString());
            const extObj = dv2[0].value.value as ExtensionObject;
            const dataType = dv2[1].value.value as NodeId;

            console.log(extObj.schema.dataTypeNodeId.toString());
            console.log(dataType.toString());
            console.log(namespaceArray2);
            namespaceArray2[3].should.equal("http://opcfoundation.org/UA/AutoID/");
            dataType.namespace.should.equal(3);
            dataType.value.should.equal(3007);
            dataType.toString().should.eql(extObj.schema.dataTypeNodeId.toString());
        }
        (transactionPerformed2-transactionPerformed1).should.be.greaterThan(250);

    });
});
