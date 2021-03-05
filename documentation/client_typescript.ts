import * as fs from "fs";
import * as path from "path";

import {
    Certificate,
    PrivateKey,
    readCertificate,
    readPrivateKey
} from "node-opcua-crypto";

import { OPCUAClient } from "../packages/node-opcua-client";

async function main() {

    try {

        const endpointUrl2 = "opc.tcp://localhost:48010";

        const client = OPCUAClient.create({
            endpoint_must_exist: false
        });
        await client.connect(endpointUrl2);

        const session = await client.createSession();

        await session.close();

        await
          client.disconnect();
    } catch (err) {

        console.log(err.message);
        process.exit(0);
    }
}
main();
