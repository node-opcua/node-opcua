const { OPCUAClient } = require("node-opcua-client");
const { parse_opcua_common } = require("..");

const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");

const optionDefinitions = [
  { name: "endpoint", alias: "e", type: String, description: "the end point to connect to " },
  { name: "securityMode", alias: "s", type: String, description: "the security mode" },
  { name: "securityPolicy", alias: "P", type: String, description: "the policy mode" },
  { name: "userName", alias: "u", type: String, description: "specify the user name of a UserNameIdentityToken " },
  { name: "password", alias: "p", type: String, description: "specify the password of a UserNameIdentityToken" }
];
const argv = commandLineArgs(optionDefinitions);
if (!argv.endpoint) {
  // was yargs .demand("endpoint"), which printed the usage and exited
  console.log(commandLineUsage([{ header: "extract_schema", optionList: optionDefinitions }]));
  process.exit(1);
}

const endpointUrl = argv.endpoint || "opc.tcp://localhost:48010";


async function parse_opcua_server(endpointUrl) {

  const options = {
    endpointMustExist: false,
    keepSessionAlive: true,
    connectionStrategy: {
      maxRetry: 10,
      initialDelay: 2000,
      maxDelay: 10 * 1000
    }
  };
  const client = OPCUAClient.create(options);
  await client.withSessionAsync(endpointUrl, async (session) => {
    await parse_opcua_common(session);
  });
}

(async () => {
  await parse_opcua_server(endpointUrl);
  console.log("done");
})();


//
// DataType
//  +-Organizes-> BaseDataType
//                 +-HasSubtype-> Structure
//                                 +-HasSubtype-> EUInformation(i=887)
//                                                 +-HasEncoding->Default Binary(i=889)
//                                                                +-HasDescription-> EUInformation (i=8876)
//                                                 +-HasEncoding->Default XML   (i=888)
//                                                                +-HasDescription-> EUInformation (i=8241)
//
//
// +->Opc Binary(i=93)
//     +->  Opc.Ua  (value=>binaryStream)
//           +-HasComponent-> EUInformation(i=8241)
//                             +-DescriptionOf->Default Binary(i=889)
// +->XML Schema(i=92)
//     +->  Opc.Ua  (value=>binaryStream)
//           +-HasComponent-> EUInformation(i=8876)
//                             +-DescriptionOf->Default XML (i=888)
//
// in XML
/*
  <xs:complexType name="EUInformation">
    <xs:sequence>
      <xs:element name="NamespaceUri" type="xs:string" minOccurs="0" nillable="true" />
      <xs:element name="UnitId" type="xs:int" minOccurs="0" />
      <xs:element name="DisplayName" type="ua:LocalizedText" minOccurs="0" nillable="true" />
      <xs:element name="Description" type="ua:LocalizedText" minOccurs="0" nillable="true" />
    </xs:sequence>
  </xs:complexType>

 */
/* in Binary
  <opc:StructuredTypeSchemaInterface Name="EUInformation" BaseType="ua:ExtensionObject">
    <opc:Field Name="NamespaceUri" TypeName="opc:String" />
    <opc:Field Name="UnitId" TypeName="opc:Int32" />
    <opc:Field Name="DisplayName" TypeName="ua:LocalizedText" />
    <opc:Field Name="Description" TypeName="ua:LocalizedText" />
  </opc:StructuredTypeSchemaInterface>
 */