
// ---------------------------------------------------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------------------------------------------------
module.exports.NodeId           = require("node-opcua-nodeid").NodeId;
module.exports.resolveNodeId    = require("node-opcua-nodeid").resolveNodeId;
module.exports.makeNodeId       = require("node-opcua-nodeid").makeNodeId;
module.exports.coerceNodeId     = require("node-opcua-nodeid").coerceNodeId;
module.exports.sameNodeId       = require("node-opcua-nodeid").sameNodeId;
module.exports.NodeIdType = require("node-opcua-nodeid").NodeIdType;

module.exports.ExpandedNodeId           = require("node-opcua-nodeid/src/expanded_nodeid").ExpandedNodeId;
module.exports.makeExpandedNodeId       = require("node-opcua-nodeid/src/expanded_nodeid").makeExpandedNodeId;
module.exports.coerceExpandedNodeId     = require("node-opcua-nodeid/src/expanded_nodeid").coerceExpandedNodeId;

module.exports.StatusCodes      = require("node-opcua-status-code").StatusCodes;


module.exports.Enum             = require("node-opcua-enum");

module.exports.DataType          = require("node-opcua-variant").DataType;
module.exports.Variant           = require("node-opcua-variant").Variant;
module.exports.VariantArrayType  = require("node-opcua-variant").VariantArrayType;
module.exports.buildVariantArray = require("node-opcua-variant").buildVariantArray;

module.exports.DataValue           = require("node-opcua-data-value").DataValue;
module.exports.sameDataValue       = require("node-opcua-data-value").sameDataValue;

module.exports.NumericRange        = require("node-opcua-numeric-range").NumericRange;

module.exports.AccessLevelFlag     = require("node-opcua-data-model").AccessLevelFlag;
module.exports.LocalizedText       = require("node-opcua-data-model").LocalizedText;
module.exports.coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
module.exports.QualifiedName       = require("node-opcua-data-model").QualifiedName;
module.exports.coerceQualifyName   = require("node-opcua-data-model").coerceQualifyName;
module.exports.NodeClass           = require("node-opcua-data-model").NodeClass;
module.exports.NodeClassMask       = require("node-opcua-data-model").NodeClassMask;
module.exports.AttributeIds        = require("node-opcua-data-model").AttributeIds;
module.exports.AttributeNameById   = require("node-opcua-data-model").AttributeNameById;
module.exports.BrowseDirection     = require("node-opcua-data-model").BrowseDirection;

module.exports.VariableTypeIds    = require("node-opcua-constants").VariableTypeIds;
module.exports.VariableIds        = require("node-opcua-constants").VariableIds;
module.exports.MethodIds          = require("node-opcua-constants").MethodIds;
module.exports.ObjectIds          = require("node-opcua-constants").ObjectIds;
module.exports.ObjectTypeIds      = require("node-opcua-constants").ObjectTypeIds;
module.exports.ReferenceTypeIds   = require("node-opcua-constants").ReferenceTypeIds;
module.exports.DataTypeIds        = require("node-opcua-constants").DataTypeIds;

// DA
module.exports.standardUnits = require("node-opcua-data-access").standardUnits;
module.exports.makeEUInformatio = require("node-opcua-data-access").makeEUInformation;
module.exports.Range = require("node-opcua-data-access").Range;

//
module.exports.get_fully_qualified_domain_name = require("node-opcua-hostname").get_fully_qualified_domain_name;
module.exports.makeApplicationUrn              = require("node-opcua-common").makeApplicationUrn;


// services
module.exports.browse_service                             = require("node-opcua-service-browse");
module.exports.read_service                               = require("node-opcua-service-read");
module.exports.write_service                              = require("node-opcua-service-write");
module.exports.call_service                               = require("node-opcua-service-call");

module.exports.session_service                            = require("node-opcua-service-session");
module.exports.AnonymousIdentityToken = module.exports.session_service.AnonymousIdentityToken;
module.exports.UserNameIdentityToken = module.exports.session_service.UserNameIdentityToken;

module.exports.register_node_service                      = require("node-opcua-service-register-node");

module.exports.get_endpoints_service                      = require("node-opcua-service-endpoints");
module.exports.EndpointDescription                        = require("node-opcua-service-endpoints").EndpointDescription;
module.exports.ApplicationType                            = require("node-opcua-service-endpoints").ApplicationType;

module.exports.subscription_service                       = require("node-opcua-service-subscription");
module.exports.historizing_service                        = require("node-opcua-service-history");
module.exports.register_server_service                    = require("node-opcua-service-register-server");
module.exports.secure_channel_service                     = require("node-opcua-service-secure-channel");

module.exports.translate_browse_paths_to_node_ids_service = require("node-opcua-service-translate-browse-path");
module.exports.BrowsePath                                 = require("node-opcua-service-translate-browse-path").BrowsePath;
module.exports.makeRelativePath                           = require("node-opcua-service-translate-browse-path").makeRelativePath;
module.exports.makeBrowsePath                             = require("node-opcua-service-translate-browse-path").makeBrowsePath;

module.exports.query_service                              = require("node-opcua-service-query");
module.exports.node_managment_service                     = require("node-opcua-service-node-management");


module.exports.ServerState = require("node-opcua-common").ServerState;
module.exports.ServiceCounter = require("node-opcua-common").ServiceCounter;

module.exports.SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
module.exports.MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

module.exports.utils = require("node-opcua-utils");
module.exports.crypto_utils = require("node-opcua-crypto").crypto_utils;
module.exports.hexDump = require("node-opcua-debug").hexDump;

//----------------------------------------------------------------------------------------------------------------------
// client services
//----------------------------------------------------------------------------------------------------------------------
module.exports.OPCUAClient        = require("node-opcua-client").OPCUAClient;
module.exports.OPCUAClientBase    = require("node-opcua-client").OPCUAClientBase;

module.exports.NodeCrawler        = require("node-opcua-client-crawler").NodeCrawler;
module.exports.ClientSubscription = require("node-opcua-client").ClientSubscription;
module.exports.ClientSession      = require("node-opcua-client").ClientSession;

module.exports.client_utils = require("node-opcua-client/src/client_utils");
module.exports.perform_findServersRequest = require("node-opcua-client").perform_findServersRequest;
module.exports.callConditionRefresh = require("node-opcua-client/src/alarms_and_conditions/client_tools").callConditionRefresh;

module.exports.parseEndpointUrl = require("node-opcua-transport").parseEndpointUrl;

//----------------------------------------------------------------------------------------------------------------------
// Server services
//----------------------------------------------------------------------------------------------------------------------
module.exports.OPCUAServer          = require("node-opcua-server").OPCUAServer;
module.exports.ServerEngine = require("node-opcua-server").ServerEngine;
module.exports.MonitoredItem = require("node-opcua-server").MonitoredItem;
module.exports.ServerSession = require("node-opcua-server").ServerSession;


module.exports.generate_address_space = require("node-opcua-address-space").generate_address_space;
module.exports.AddressSpace = require("node-opcua-address-space").AddressSpace;
module.exports.SessionContext = require("node-opcua-address-space").SessionContext;
// basic opcua NodeClass
module.exports.UAObject = require("node-opcua-address-space").UAObject;
module.exports.UAMethod = require("node-opcua-address-space").UAMethod;
module.exports.UAVariable = require("node-opcua-address-space").UAVariable;
module.exports.UADataType = require("node-opcua-address-space").UADataType;

module.exports.getAddressSpaceFixture = require("node-opcua-address-space/test_helpers/get_address_space_fixture").getAddressSpaceFixture;
module.exports.OPCUADiscoveryServer = require("node-opcua-server-discovery").OPCUADiscoveryServer;


// version
module.exports.version                = require("./package.json").version;


module.exports.nodesets = require("node-opcua-nodesets");
module.exports.constructNodesetFilename = module.exports.nodesets.constructNodesetFilename;
module.exports.standard_nodeset_file = module.exports.nodesets.standard_nodeset_file;
module.exports.di_nodeset_filename = module.exports.nodesets.di_nodeset_filename;
module.exports.adi_nodeset_filename = module.exports.nodesets.adi_nodeset_filename;

// an incomplete but sufficient nodeset file used during testing
module.exports.mini_nodeset_filename = require("node-opcua-address-space/test_helpers/get_mini_address_space").mini_nodeset_filename;
module.exports.empty_nodeset_filename = require("node-opcua-address-space/test_helpers/get_mini_address_space").empty_nodeset_filename;
var address_space_for_conformance_testing = require("node-opcua-address-space-for-conformance-testing");


module.exports.is_valid_endpointUrl = require("node-opcua-transport").is_valid_endpointUrl;

// filtering tools
module.exports.checkSelectClause = require("node-opcua-address-space").checkSelectClause;
module.exports.constructEventFilter = require("node-opcua-service-filter").constructEventFilter;

module.exports.build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

module.exports.install_optional_cpu_and_memory_usage_node = require("node-opcua-vendor-diagnostic").install_optional_cpu_and_memory_usage_node;
module.exports.construct_demo_alarm_in_address_space = require("node-opcua-address-space/test_helpers/alarms_and_conditions_demo").construct_demo_alarm_in_address_space;

module.exports.createBoilerType = require("node-opcua-address-space/test_helpers/boiler_system").createBoilerType;
module.exports.makeBoiler = require("node-opcua-address-space/test_helpers/boiler_system").makeBoiler;

