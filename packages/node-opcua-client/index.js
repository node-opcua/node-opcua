module.exports = {

    OPCUAClientBase: require("./src/client_base").OPCUAClientBase,

    OPCUAClient:   require("./src/opcua_client").OPCUAClient,

    ClientSession: require("./src/client_session").ClientSession,

    ClientSubscription: require("./src/client_subscription").ClientSubscription,

    ClientSecureChannelLayer: require("node-opcua-secure-channel/src/client/client_secure_channel_layer").ClientSecureChannelLayer,

    perform_findServersRequest: require("./src/tools/findservers").perform_findServersRequest,

};

module.exports.NodeId = require("node-opcua-nodeid").NodeId;
module.exports.resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
module.exports.makeNodeId = require("node-opcua-nodeid").makeNodeId;
module.exports.coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
module.exports.sameNodeId = require("node-opcua-nodeid").sameNodeId;

module.exports.ExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").ExpandedNodeId;
module.exports.makeExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;
module.exports.coerceExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").coerceExpandedNodeId;

module.exports.StatusCodes = require("node-opcua-status-code").StatusCodes;


module.exports.DataType = require("node-opcua-variant").DataType;
module.exports.Variant = require("node-opcua-variant").Variant;
module.exports.VariantArrayType = require("node-opcua-variant").VariantArrayType;
module.exports.buildVariantArray = require("node-opcua-variant").buildVariantArray;

module.exports.DataValue = require("node-opcua-data-value").DataValue;
module.exports.sameDataValue = require("node-opcua-data-value").sameDataValue;


module.exports.AccessLevelFlag = require("node-opcua-data-model").AccessLevelFlag;
module.exports.LocalizedText = require("node-opcua-data-model").LocalizedText;
module.exports.coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
module.exports.QualifiedName = require("node-opcua-data-model").QualifiedName;
module.exports.coerceQualifyName = require("node-opcua-data-model").coerceQualifyName;
module.exports.NodeClass = require("node-opcua-data-model").NodeClass;
module.exports.NodeClassMask = require("node-opcua-data-model").NodeClassMask;
module.exports.AttributeIds = require("node-opcua-data-model").AttributeIds;
module.exports.AttributeNameById = require("node-opcua-data-model").AttributeNameById;
module.exports.BrowseDirection = require("node-opcua-data-model").BrowseDirection;

module.exports.VariableTypeIds = require("node-opcua-constants").VariableTypeIds;
module.exports.VariableIds = require("node-opcua-constants").VariableIds;
module.exports.MethodIds = require("node-opcua-constants").MethodIds;
module.exports.ObjectIds = require("node-opcua-constants").ObjectIds;
module.exports.ObjectTypeIds = require("node-opcua-constants").ObjectTypeIds;
module.exports.ReferenceTypeIds = require("node-opcua-constants").ReferenceTypeIds;
module.exports.DataTypeIds = require("node-opcua-constants").DataTypeIds;

//
module.exports.get_fully_qualified_domain_name = require("node-opcua-hostname").get_fully_qualified_domain_name;
module.exports.makeApplicationUrn = require("node-opcua-common").makeApplicationUrn;


// services
module.exports.browse_service = require("node-opcua-service-browse");
module.exports.read_service = require("node-opcua-service-read");
module.exports.write_service = require("node-opcua-service-write");
module.exports.call_service = require("node-opcua-service-call");

module.exports.session_service = require("node-opcua-service-session");
module.exports.AnonymousIdentityToken = module.exports.session_service.AnonymousIdentityToken;
module.exports.UserNameIdentityToken = module.exports.session_service.UserNameIdentityToken;


module.exports.get_endpoints_service = require("node-opcua-service-endpoints");
module.exports.EndpointDescription = require("node-opcua-service-endpoints").EndpointDescription;
module.exports.ApplicationType = require("node-opcua-service-endpoints").ApplicationType;

module.exports.subscription_service = require("node-opcua-service-subscription");
module.exports.historizing_service = require("node-opcua-service-history");
module.exports.register_server_service = require("node-opcua-service-register-server");
module.exports.secure_channel_service = require("node-opcua-service-secure-channel");

module.exports.translate_browse_paths_to_node_ids_service = require("node-opcua-service-translate-browse-path");
module.exports.BrowsePath = require("node-opcua-service-translate-browse-path").BrowsePath;
module.exports.makeRelativePath = require("node-opcua-service-translate-browse-path").makeRelativePath;
module.exports.makeBrowsePath = require("node-opcua-service-translate-browse-path").makeBrowsePath;

module.exports.query_service = require("node-opcua-service-query");


module.exports.ServerState = require("node-opcua-common").ServerState;
module.exports.ServiceCounter = require("node-opcua-common").ServiceCounter;

module.exports.SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
module.exports.MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

module.exports.utils = require("node-opcua-utils");
module.exports.crypto_utils = require("node-opcua-crypto").crypto_utils;
module.exports.hexDump = require("node-opcua-debug").hexDump;

//xx module.exports.Enum                      = require("node-opcua-enum");
//xx module.exports.NumericRange              = require("node-opcua-numeric-range").NumericRange;
// DA
//xx module.exports.standardUnits             = require("node-opcua-data-access").standardUnits;
//xx module.exports.makeEUInformatio          = require("node-opcua-data-access").makeEUInformation;
//xx module.exports.Range                     = require("node-opcua-data-access").Range;
//xx module.exports.register_node_service                      = require("node-opcua-service-register-node");
//xx module.exports.node_managment_service                     = require("node-opcua-service-node-management");

