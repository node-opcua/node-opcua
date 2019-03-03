// compile with  tsc --lib es2018 client_with_custom_datatype.ts
// tslint:disable:no-console
import chalk from "chalk";
import * as os from "os";

import {
    AttributeIds,
    BrowseResult,
    ConnectionStrategyOptions,
    extractNamespaceDataType,
    ExtraDataTypeManager,
    getDataTypeDefinition,
    MessageSecurityMode,
    NodeId,
    OPCUAClient,
    OPCUAClientOptions,
    resolveDynamicExtensionObject,
    SecurityPolicy,
    UserTokenType
} from "node-opcua-client";

const doDebug = true;

(async () => {
    try {

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

        await getDataTypeDefinition(session, dataTypeNodeId);

        const dataValueDataTypeBrowseName = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: dataValueDataType.value.value
        });
        console.log(" DataType BrowseName", dataValueDataTypeBrowseName.value.value.toString());

        console.log(chalk.yellow(" Value before  ================> "));
        const dataValue = await session.read({ nodeId: variableNodeID, attributeId: AttributeIds.Value });
        console.log(dataValue.toString());
        console.log(chalk.yellow(" Value before  <================ "));

        const extraDataTypeManager = new ExtraDataTypeManager();
        await extractNamespaceDataType(session, extraDataTypeManager);

        // now re-read the same WorkItem variable to check that we can get the extension object
        console.log(chalk.yellow(" Value after  ================> "));
        const dataValue2 = await session.read({ nodeId: variableNodeID, attributeId: AttributeIds.Value });

        await resolveDynamicExtensionObject(dataValue2.value, extraDataTypeManager);

        console.log(dataValue2.toString());
        console.log(chalk.yellow(" Value after  <================ "));

        await session.close();

        await client.disconnect();

        console.log("Done !");
    } catch (e) {

        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }
})();
