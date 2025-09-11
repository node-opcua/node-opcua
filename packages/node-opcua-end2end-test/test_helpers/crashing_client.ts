// a simple client that is design to crash in the middle of a connection
// once a item has been monitored
"use strict";
import { hostname } from "os";

console.log("process.argv.length ", process.argv.length);

import { OPCUAClient  } from "node-opcua-client";


async function main() {
    if (process.argv.length !== 3) {
        console.log(" Invalid number of argument, please specify port number");
        return;
    }
    const port = process.argv[2];

    const endpointUrl = "opc.tcp://" + hostname() + ":" + port;
    console.log("endpointUrl = ", endpointUrl);

    const options = {
        endpointMustExist: false,
        requestedSessionTimeout: 101, // very short
        keepSessionAlive: true,
        connectionStrategy: {
            maxRetry: 0 // << NO RETRY !
        }
    };


    const client = OPCUAClient.create(options);

    try {
        await client.connect(endpointUrl);
        console.log("connected !");

        // step 2 : createSession
        const session = await client.createSession();

        // wait 
        console.log("About to CRASH !!!!");
        await new Promise<void>((resolve) => setTimeout(resolve, 3000));
        console.log(" CRASHING !!!!");
        process.exit(-1);

    } catch (err) {
        console.log(" cannot connect to endpoint :", endpointUrl);
    }

}
main();
