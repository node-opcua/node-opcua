require("requirish")._(module);

// common services
module.exports.structures       = require("lib/datamodel/structures");
module.exports.parseEndpointUrl = require("lib/nodeopcua").parseEndpointUrl;
module.exports.resolveNodeId    = require("lib/datamodel/nodeid").resolveNodeId;
module.exports.makeNodeId       = require("lib/datamodel/nodeid").makeNodeId;
module.exports.coerceNodeId     = require("lib/datamodel/nodeid").coerceNodeId;
module.exports.makeExpandedNodeId       = require("lib/datamodel/expanded_nodeid").makeExpandedNodeId;
module.exports.coerceExpandedNodeId     = require("lib/datamodel/expanded_nodeid").coerceExpandedNodeId;
module.exports.StatusCodes      = require("lib/datamodel/opcua_status_code").StatusCodes;
module.exports.DataType         = require("lib/datamodel/variant").DataType;
module.exports.DataValue        = require("lib/datamodel/datavalue").DataValue;
module.exports.Variant          = require("lib/datamodel/variant").Variant;
module.exports.VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
module.exports.NodeId           = require("lib/datamodel/nodeid").NodeId;
module.exports.NumericRange     = require("lib/datamodel/numeric_range").NumericRange;
module.exports.AccessLevelFlag  = require("lib/datamodel/access_level").AccessLevelFlag;



// services
module.exports.browse_service   = require("lib/services/browse_service");
module.exports.read_service     = require("lib/services/read_service");
module.exports.call_service     = require("lib/services/call_service");
module.exports.session_service  = require("lib/services/session_service");
module.exports.get_endpoints_service  = require("lib/services/get_endpoints_service");

module.exports.EndpointDescription =  module.exports.get_endpoints_service.EndpointDescription;

module.exports.utils     = require("lib/misc/utils");

module.exports.AttributeIds     = module.exports.read_service.AttributeIds;
module.exports.AttributeNameById= module.exports.read_service.AttributeNameById;
module.exports.VariableIds      = require("lib/opcua_node_ids").VariableIds;
module.exports.MethodIds        = require("lib/opcua_node_ids").MethodIds;
module.exports.ObjectIds        =require("lib/opcua_node_ids").ObjectIds;

// client services
module.exports.OPCUAClient        = require("lib/client/opcua_client").OPCUAClient;
module.exports.NodeCrawler        = require("lib/client/node_crawler").NodeCrawler;
module.exports.ClientSubscription = require("lib/client/client_subscription").ClientSubscription;
module.exports.ClientSession       = require("lib/client/opcua_client").ClientSession;

// Server services
module.exports.OPCUAServer      = require("lib/server/opcua_server").OPCUAServer;
module.exports.ServerEngine     = require("lib/server/server_engine").ServerEngine;
module.exports.generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
module.exports.AddressSpace     = require("lib/address_space/address_space").AddressSpace;

module.exports.SecurityPolicy = require("lib/misc/security_policy").SecurityPolicy;

module.exports.AnonymousIdentityToken  =module.exports.session_service.AnonymousIdentityToken;

//
module.exports.MessageSecurityMode = module.exports.get_endpoints_service.MessageSecurityMode;


// DA
module.exports.standardUnits = require("lib/data_access/EUInformation").standardUnits;
module.exports.makeEUInformation = require("lib/data_access/EUInformation").makeEUInformation;
module.exports.addAnalogDataItem = require("lib/data_access/UAAnalogItem").addAnalogDataItem;

// version
module.exports.version = require("./package.json").version;
module.exports.standard_nodeset_file = require("lib/server/server_engine").standard_nodeset_file;

// an incomplete but sufficient nodeset file used during testing
module.exports.mini_nodeset_filename = require("lib/server/server_engine").mini_nodeset_filename;

module.exports.is_valid_endpointUrl = require("lib/nodeopcua").is_valid_endpointUrl;

module.exports.client_utils = require("lib/client/client_utils");
