require("node-opcua-service-secure-channel");

var SessionSecurityDiagnostics_Schema = {
    id: "ns=0;i=870",
    name: "SessionSecurityDiagnostics",
    fields: [
       {
           name: "sessionId",
           fieldType: "NodeId"
       },
       {
           name: "clientUserIdOfSession",
           fieldType: "String"
       },
       {
           name: "clientUserIdHistory",
           fieldType: "String"
       },
       {
           name: "authenticationMechanism",
           fieldType: "String"
       },
       {
           name: "encoding",
           fieldType: "String"
       },
       {
           name: "transportProtocol",
           fieldType: "String"
       },
       {
           name: "securityMode",
           fieldType: "MessageSecurityMode"
       },
       {
           name: "securityPolicyUri",
           fieldType: "String"
       },
       {
           name: "clientCertificate",
           fieldType: "ByteString"
       },
        ]
    };
exports.SessionSecurityDiagnostics_Schema = SessionSecurityDiagnostics_Schema;