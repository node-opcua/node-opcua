// compile with  tsc --lib es2018 client_with_custom_datatype.ts
// tslint:disable:no-console
import * as chalk from "chalk";
import * as os from "os";

import {
    AttributeIds,
    ConnectionStrategyOptions,
    MessageSecurityMode,
    NodeId,
    OPCUAClient,
    OPCUAClientOptions,
    SecurityPolicy} from "node-opcua-client";

const doDebug = true;

async function main() {

    const connectionStrategy: ConnectionStrategyOptions = {
        initialDelay: 1000,
        maxRetry: 1
    };
    const options: OPCUAClientOptions = {
        applicationName: "ClientWithCustomDataTypeSupport",
        connectionStrategy,
        securityMode: MessageSecurityMode.None,
        // securityPolicy: SecurityPolicy.Basic256Sha256
        securityPolicy: SecurityPolicy.None
    };

    const client = OPCUAClient.create(options);

    console.log(" about to connect");
    await client.connect("opc.tcp://" + os.hostname() + ":48010");
    console.log("connected");

    client.on("backoff", () => {
        console.log("Backoff");
    });

    const session = await client.createSession();

    const variableNodeID = "ns=2;s=Demo.WorkOrder.WorkOrderVariable";

    const dataValueDataType = await session.read({ nodeId: variableNodeID, attributeId: AttributeIds.DataType });
    console.log(" DataType =", dataValueDataType.value.value.toString());
    const dataTypeNodeId = dataValueDataType.value.value as NodeId;
  
    const dataValueDataTypeBrowseName = await session.read({
        attributeId: AttributeIds.BrowseName,
        nodeId: dataValueDataType.value.value
    });
    console.log(" DataType BrowseName", dataValueDataTypeBrowseName.value.value.toString());

    const dataValue = await session.read({ nodeId: variableNodeID, attributeId: AttributeIds.Value });
    console.log(dataValue.toString());

    await session.close();

    await client.disconnect();

    console.log("Done !");
}

(async () => {
    try {
        const promises = [];
        promises.push(main());
        promises.push(main());
        promises.push(main());
        await Promise.all(promises);

    } catch (e) {
        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }
})();
