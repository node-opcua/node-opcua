"use strict";
require("requirish")._(module);
var ExtensionObject = require("lib/misc/extension_object").ExtensionObject;

// OPC Unified Architecture, Part 4  $7.27 page 139
var RequestHeader_Schema = {
    name: "RequestHeader",
    fields: [

        // The secret Session identifier used to verify that the request is associated with
        // the Session. The SessionAuthenticationToken type is defined in 7.29.
        { name: "authenticationToken", fieldType: "NodeId" },

        // The time the Client sent the request.
        { name: "timeStamp", fieldType: "UtcTime", defaultValue: function () {
            return new Date();
        }  },

        // A requestHandle associated with the request. This client defined handle can
        // be used to cancel the request. It is also returned in the response.
        { name: "requestHandle", fieldType: "IntegerId", defaultValue: function () {
            return 0xDEADBEEF;
        }                 },

        // A bit mask that identifies the types of vendor-specific diagnostics to be
        // returned in diagnosticInfo response parameters.
        { name: "returnDiagnostics", fieldType: "UInt32"                     },

        // An identifier that identifies the Client's security audit log entry associated with
        // this request.
        { name: "auditEntryId", fieldType: "UAString"                   },

        { name: "timeoutHint", fieldType: "UInt32"                    },

        // Reserved for future use.
        { name: "additionalHeader", fieldType: "ExtensionObject" }
    ]
};

exports.RequestHeader_Schema = RequestHeader_Schema;