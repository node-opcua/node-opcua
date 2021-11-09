// compile with  tsc --lib es2018 sample1.ts
// tslint:disable:no-console
import * as chalk from "chalk";

import {
    Argument,
    AttributeIds,
    ConnectionStrategyOptions,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAClientOptions,
    SecurityPolicy,
    UserTokenType,
    Variant
} from "node-opcua-client";

const connectionStrategy: ConnectionStrategyOptions = {
    initialDelay: 1000,
    maxRetry: 1
};
const options: OPCUAClientOptions = {
    applicationName: "Hello",
    connectionStrategy,
    securityMode: MessageSecurityMode.None,
    // securityPolicy: SecurityPolicy.Basic256Sha256
    securityPolicy: SecurityPolicy.None
};

const client = OPCUAClient.create(options);

(async () => {
    try {
        console.log(" about to connect");
        await client.connect("opc.tcp://opcuademo.sterfive.com:26543");
        console.log("connected");

        client.on("backoff", () => {
            console.log("Backoff");
        });

        const session = await client.createSession({
            password: "password1",
            type: UserTokenType.UserName,
            userName: "user1"
        });

        const a = await session.getArgumentDefinition("ns=0;i=12886");

        console.log(a.inputArguments.map((x: Argument) => x.toString()).join(" "));

        const result = await session.browse({
            nodeId: "i=2558"
        });

        for (const reference of result.references!) {
            console.log(reference.toString());
        }
        const registeredNodes = await session.registerNodes(["ns=1;s=FanSpeed", "ns=1;s=PumpSpeed"]);

        const fanSpeedId = registeredNodes[0].toString();
        const pumpSpeedId = registeredNodes[1].toString();

        console.log("registered Node", fanSpeedId);
        console.log("registered Node", pumpSpeedId);

        const value = await session.read({ nodeId: fanSpeedId, attributeId: AttributeIds.Value });
        console.log(`FanSpeed ${value.toString()}`);

        const value2 = await session.read({ nodeId: pumpSpeedId, attributeId: AttributeIds.Value });
        console.log(`PumpSpeed ${value2.toString()}`);

        await client.disconnect();
    } catch (e) {
        // Deal with the fact the chain failed

        console.log(chalk.red("Error !"), e);
        process.exit(-1);
    }
})();
