// compile with  tsc --lib es2018 client_with_custom_datatype.ts
// tslint:disable:no-console
import * as os from "os";

import {
    BrowseDescriptionLike,
    BrowseResult,
    ConnectionStrategyOptions,
    DataType,
    DataValueT,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAClientOptions,
    SecurityPolicy,
    StatusCode,
    StatusCodes,
    UserTokenType,
    Variant
} from "node-opcua-client";

// this test requires UA C++ Demo Server
const addNodeMethodNodeId = "ns=2;s=Demo.Massfolder_Static.AddNodes";
const endpointUri = "opc.tcp://" + os.hostname() + ":48010";

const doDebug = true;

async function main() {
    const connectionStrategy: ConnectionStrategyOptions = {
        initialDelay: 1000,
        maxRetry: 1
    };
    const options: OPCUAClientOptions = {
        applicationName: "ClientBrowseNextDemo",
        connectionStrategy,
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None
    };

    const client = OPCUAClient.create(options);

    await client.connect(endpointUri);

    client.on("backoff", () => {
        console.log("Backoff");
    });

    const session = await client.createSession();

    const result = await session.call({
        inputArguments: [
            new Variant({
                dataType: DataType.UInt32,
                value: 100000
            })
        ],
        methodId: addNodeMethodNodeId,
        objectId: "ns=2;s=Demo.Massfolder_Static"
    });
    console.log(result.toString());

    // now browse the 10 thousands nodes
    const nodeToBrowse: BrowseDescriptionLike = {
        nodeId: "ns=2;s=Demo.Massfolder_Static"
    };

    try {
        let browseResult = await session.browse(nodeToBrowse);
        console.log("BrowseResult = ", browseResult.toString());
        if (browseResult.statusCode === StatusCodes.Good) {
            // console.log(browseResult.toString());
            console.log("reading initial ", browseResult.references!.length, "elements");
            let continuationPoint = browseResult.continuationPoint;
            while (continuationPoint) {
                browseResult = await session.browseNext(continuationPoint, false);
                console.log("reading extra ", browseResult.references!.length);

                continuationPoint = browseResult.continuationPoint;
            }
        } else {
            console.log("BrowseResult = ", browseResult.statusCode.toString());
        }
    } catch (err) {
        if (err instanceof Error) {
            console.log("err", err.message);
        }
        console.log(err);
    }

    await session.close();

    await client.disconnect();

    console.log("Done !");
}

main();
