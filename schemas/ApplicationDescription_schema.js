
var ApplicationType = require("./ApplicationType_enum").ApplicationType;

// OPC Unified Architecture, Part 4 $7.1 page 106
var ApplicationDescription_Schema = {
    name: "ApplicationDescription",
    fields: [
        // The globally unique identifier for the application instance.
        { name: "applicationUri", fieldType: "String"             },

        // The globally unique identifier for the product.
        { name: "productUri", fieldType: "String"              },
        // A localized descriptive name for the application.
        { name: "applicationName", fieldType: "LocalizedText"       },

        // The type of application.
        { name: "applicationType", fieldType: "ApplicationType" },

        // A URI that identifies the Gateway Server associated with the discoveryUrls .
        // this flag is not used if applicationType === CLIENT
        { name: "gatewayServerUri", fieldType: "String"             },

        // A URI that identifies the discovery profile supported by the URLs provided
        { name: "discoveryProfileUri", fieldType: "String"             },

        // A list of URLs for the discovery Endpoints provided by the application
        { name: "discoveryUrls", isArray: true, fieldType: "String"             }

    ]
};
exports.ApplicationDescription_Schema = ApplicationDescription_Schema;