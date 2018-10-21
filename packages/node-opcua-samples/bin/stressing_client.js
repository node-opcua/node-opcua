"use strict";

const opcua = require("node-opcua");
const endpointUrl = "opc.tcp://localhost:26543";
async function main()  {

    let counter = 1;

    while(true) {

        const client = opcua.OPCUAClient.create({endpoint_must_exist: false});
        client.on("backoff",(a,b)=>console.log("    backoff",a,b));

        try {
            await client.connect(endpointUrl);
            const session = await client.createSession();
            await session.close();
            await client.disconnect();
        }
        catch(err) {
            console.log("err",err.message);
        }

        console.log(" Connected = ",counter++);
    }
}
main();
