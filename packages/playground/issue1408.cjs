process.env.NODEOPCUADEBUG="CLIENT{TRACE-RESPONSE-REQUEST}";
process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE="10000" ;
process.env.ARRAYLENGTH=100000;

const endpointUrl = `opc.tcp://opcuademo.sterfive.com:26543`;


const { OPCUAClient, MessageSecurityMode,   SecurityPolicy} = require("node-opcua");

async function main() {


  const client = OPCUAClient.create({});

  await client.withSessionAsync(endpointUrl, async (session) =>{
    console.log("calling extractNamespaceDataType ...");
    await session.extractNamespaceDataType();
    console.log("extractNamespaceDataType done...");
  });
  console.log("bye");
}
main();