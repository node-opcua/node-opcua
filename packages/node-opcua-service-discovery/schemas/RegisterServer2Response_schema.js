require("node-opcua-service-secure-channel");
require("node-opcua-data-model");
const RegisterServer2Response_Schema = {
    documentation: " A standard header included in all responses returned by servers.",
    name: "RegisterServer2Response",
    fields: [
        {
            name: "responseHeader",
            fieldType: "ResponseHeader",
            documentation: "A standard header included in all responses returned by servers."
        },
        {
            name: "configurationResults",
            fieldType: "StatusCode",
            isArray: true,
            documentation: "List of results for the discovery configuration parameters."
        },
        {
            name: "diagnosticInfos",
            isArray: true,
            fieldType: "DiagnosticInfo",
            documentation: "List of diagnostic information for the discovery configuration\n" +
            "parameters. This list is empty if diagnostics information was not\n" +
            "requested in the request header or if no diagnostic information was\n" +
            "encountered in processing of the request."
        }

    ]
};
exports.RegisterServer2Response_Schema = RegisterServer2Response_Schema;