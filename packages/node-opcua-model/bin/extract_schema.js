const opcua = require("node-opcua-client");
const async = require("async");
const assert = require("node-opcua-assert").assert;

const yargs = require("yargs/yargs");

const argv = yargs(process.argv)
    .wrap(132)
    //.usage("Usage: $0 -d --endpoint <endpointUrl> [--securityMode (NONE|SIGNANDENCRYPT|SIGN)] [--securityPolicy (None|Basic256|Basic128Rsa15)] --node <node_id_to_monitor> --crawl")
    .demand("endpoint")
    .string("endpoint")
    .describe("endpoint", "the end point to connect to ")
    .string("securityMode")
    .describe("securityMode", "the security mode")
    .string("securityPolicy")
    .describe("securityPolicy", "the policy mode")
    .string("userName")
    .describe("userName", "specify the user name of a UserNameIdentityToken ")
    .string("password")
    .describe("password", "specify the password of a UserNameIdentityToken")
    .alias("e", "endpoint")
    .alias("s", "securityMode")
    .alias("P", "securityPolicy")
    .alias("u", "userName")
    .alias("p", "password")
    .argv;

const endpointUrl = argv.endpoint || "opc.tcp://localhost:48010";
const parse_opcua_common = require("../lib/parse_server_common").parse_opcua_common;


function parse_opcua_server(endpoint, callback) {

    const options = {
        endpoint_must_exist: false,
        keepSessionAlive: true,
        connectionStrategy: {
            maxRetry: 10,
            initialDelay: 2000,
            maxDelay: 10 * 1000
        }
    };

    const client = new opcua.OPCUAClient(options);
    client.withSession(endpointUrl, function (session, callback) {
        parse_opcua_common(session, callback);
    }, function (err) {
        callback(err);
    });
}

parse_opcua_server(endpointUrl, function (err) {
    console.log("done", err);
});

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
  <opc:StructuredType Name="EUInformation" BaseType="ua:ExtensionObject">
    <opc:Field Name="NamespaceUri" TypeName="opc:String" />
    <opc:Field Name="UnitId" TypeName="opc:Int32" />
    <opc:Field Name="DisplayName" TypeName="ua:LocalizedText" />
    <opc:Field Name="Description" TypeName="ua:LocalizedText" />
  </opc:StructuredType>
 */