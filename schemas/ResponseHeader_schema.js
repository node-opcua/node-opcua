
// OPC Unified Architecture, Part 4  $7.27 page 139
var ResponseHeader_Schema = {
    name: "ResponseHeader",
    fields: [
        // The time the Server sent the response.
        { name: "timeStamp", fieldType: "UtcTime", defaultValue: function () {
            return new Date();
        }  },

        // The requestHandle given by the Client to the request.
        { name: "requestHandle", fieldType: "IntegerId"                  },

        // OPC UA-defined result of the Service invocation.
        { name: "serviceResult", fieldType: "StatusCode"                 },

        { name: "serviceDiagnostics", fieldType: "DiagnosticInfo", documentation: "The diagnostics associated with the ServiceResult." },
        // There is one string in this list for each unique namespace, symbolic identifier,
        // and localized text string contained in all of the diagnostics information
        // parameters contained in the response (see 7.8). Each is identified within this
        // table by its zero-based index.
        { name: "stringTable", isArray: true, fieldType: 'String'                     },

        // Reserved for future use.
        { name: "additionalHeader", fieldType: "ExtensionObject" }

    ]
};

exports.ResponseHeader_Schema = ResponseHeader_Schema;