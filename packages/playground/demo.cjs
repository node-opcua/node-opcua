const { OPCUAClient, AttributeIds} = require("node-opcua");

(async ()=>{

    const client = OPCUAClient.create({});

    await client.connect("opc.tcp://opcuademo.sterfive.com:26540");

    const session = await client.createSession();


    const dataValue = await session.read({
        nodeId: "ns=1;i=2553"
        ,attrributeId: AttributeIds.Value
    });
    console.log(dataValue.toString());
    
    await session.close();
    await client.disconnect();
})();
