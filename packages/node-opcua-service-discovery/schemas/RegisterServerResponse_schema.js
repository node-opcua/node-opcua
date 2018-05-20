require("node-opcua-service-secure-channel");
require("node-opcua-data-model");
const RegisterServerResponse_Schema = {
    documentation:" A standard header included in all responses returned by servers.",
    name: "RegisterServerResponse",
    fields: [
        { name:"responseHeader",                           fieldType:"ResponseHeader",                 documentation: "A standard header included in all responses returned by servers."}
    ]
};
exports.RegisterServerResponse_Schema = RegisterServerResponse_Schema;