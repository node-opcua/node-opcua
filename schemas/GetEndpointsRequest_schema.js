// OPC Unified Architecture, Part 4 page 16
var GetEndpointsRequest_Schema = {
    name: "GetEndpointsRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"                  },

        // The network address that the Client used to access the Discovery Endpoint .
        // The Server uses this information for diagnostics and to determine what
        // URLs to return in the response.
        // The Server should return a suitable default URL if it does not recognize
        // the HostName in the URL.
        { name: "endpointUrl", fieldType: "String"                         },

        // List of locales to use.
        // Specifies the locale to use when returning human readable strings.
        { name: "localeIds", isArray: true, fieldType: "LocaleId"               },

        // List of transport profiles that the returned Endpoints shall support.
        { name: "profileUris", isArray: true, fieldType: "String"               }

    ]
};

exports.GetEndpointsRequest_Schema = GetEndpointsRequest_Schema;