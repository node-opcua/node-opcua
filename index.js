"use strict";

process.env.NODE_PATH=__dirname + ";" + process.env.NODE_PATH;
require('module').Module._initPaths();

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
module.exports.ExpandedNodeId = require("lib/datamodel/expanded_nodeid").ExpandedNodeId;

module.exports.sameNodeId = require("lib/datamodel/nodeid").sameNodeId;
module.exports.NumericRange     = require("lib/datamodel/numeric_range").NumericRange;
module.exports.AccessLevelFlag  = require("lib/datamodel/access_level").AccessLevelFlag;

module.exports.LocalizedText       = require("lib/datamodel/localized_text").LocalizedText;
module.exports.coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
module.exports.QualifiedName       = require("lib/datamodel/qualified_name").QualifiedName;
module.exports.coerceQualifyName   = require("lib/datamodel/qualified_name").coerceQualifyName;

module.exports.Range               = require("lib/data_access/Range").Range;

//
module.exports.get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;
module.exports.makeApplicationUrn              = require("lib/misc/applicationurn").makeApplicationUrn;

module.exports.NodeClass = require("lib/datamodel/nodeclass").NodeClass;

// services
module.exports.browse_service                             = require("lib/services/browse_service");
module.exports.BrowseDirection = module.exports.browse_service.BrowseDirection;

module.exports.read_service                               = require("lib/services/read_service");
module.exports.write_service                              = require("lib/services/write_service");
module.exports.call_service                               = require("lib/services/call_service");
module.exports.session_service                            = require("lib/services/session_service");
module.exports.get_endpoints_service                      = require("lib/services/get_endpoints_service");
module.exports.subscription_service                       = require("lib/services/subscription_service");
module.exports.historizing_service                        = require("lib/services/historizing_service");
module.exports.register_server_service                    = require("lib/services/register_server_service");
module.exports.secure_channel_service                     = require("lib/services/secure_channel_service");
module.exports.translate_browse_paths_to_node_ids_service = require("lib/services/translate_browse_paths_to_node_ids_service");
module.exports.BrowsePath = module.exports.translate_browse_paths_to_node_ids_service.BrowsePath;

module.exports.query_service           = require("lib/services/query_service");
module.exports.node_managment_service  = require("lib/services/node_management_service");


module.exports.EndpointDescription =  module.exports.get_endpoints_service.EndpointDescription;

module.exports.utils              = require("lib/misc/utils");

module.exports.AttributeIds       = module.exports.read_service.AttributeIds;
module.exports.AttributeNameById  = module.exports.read_service.AttributeNameById;
module.exports.VariableTypeIds    = require("lib/opcua_node_ids").VariableTypeIds;
module.exports.VariableIds        = require("lib/opcua_node_ids").VariableIds;
module.exports.MethodIds          = require("lib/opcua_node_ids").MethodIds;
module.exports.ObjectIds          = require("lib/opcua_node_ids").ObjectIds;
module.exports.ObjectTypeIds      = require("lib/opcua_node_ids").ObjectTypeIds;
module.exports.ReferenceTypeIds   = require("lib/opcua_node_ids").ReferenceTypeIds;

module.exports.ApplicationType    = module.exports.get_endpoints_service.ApplicationType;

// client services
module.exports.OPCUAClient        = require("lib/client/opcua_client").OPCUAClient;
module.exports.NodeCrawler        = require("lib/client/node_crawler").NodeCrawler;
module.exports.ClientSubscription = require("lib/client/client_subscription").ClientSubscription;
module.exports.ClientSession      = require("lib/client/opcua_client").ClientSession;

// Server services
module.exports.OPCUAServer        = require("lib/server/opcua_server").OPCUAServer;
module.exports.OPCUADiscoveryServer = require("lib/server/opcua_discovery_server").OPCUADiscoveryServer;
module.exports.ServerEngine       = require("lib/server/server_engine").ServerEngine;
module.exports.generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
module.exports.AddressSpace       = require("lib/address_space/address_space").AddressSpace;
module.exports.ServerState        = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServerState_enum").ServerState;
module.exports.SecurityPolicy     = require("lib/misc/security_policy").SecurityPolicy;
module.exports.ServiceCounter     = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServiceCounter").ServiceCounter;
module.exports.SessionContext = require("lib/server/session_context").SessionContext;

// basic opcua NodeClass
module.exports.UAObject  = require("lib/address_space/ua_object").UAObject;
module.exports.UAMethod  = require("lib/address_space/ua_method").UAMethod;
module.exports.UAVariable= require("lib/address_space/ua_variable").UAVariable;
module.exports.UADataType= require("lib/address_space/ua_data_type").UADataType;


module.exports.AnonymousIdentityToken = module.exports.session_service.AnonymousIdentityToken;
module.exports.UserNameIdentityToken = module.exports.session_service.UserNameIdentityToken;

//
module.exports.MessageSecurityMode = module.exports.get_endpoints_service.MessageSecurityMode;

module.exports.makeRelativePath = require("lib/address_space/make_relative_path").makeRelativePath;


// DA
module.exports.standardUnits                  = require("lib/data_access/EUInformation").standardUnits;
module.exports.makeEUInformation              = require("lib/data_access/EUInformation").makeEUInformation;


// version
module.exports.version               = require("./package.json").version;
module.exports.standard_nodeset_file  = require("lib/server/server_engine").standard_nodeset_file;
module.exports.di_nodeset_filename    = require("lib/server/server_engine").di_nodeset_filename;
module.exports.adi_nodeset_filename   = require("lib/server/server_engine").adi_nodeset_filename;

// an incomplete but sufficient nodeset file used during testing
module.exports.mini_nodeset_filename  = require("lib/server/server_engine").mini_nodeset_filename;
module.exports.part8_nodeset_filename = require("lib/server/server_engine").part8_nodeset_filename;


module.exports.is_valid_endpointUrl = require("lib/nodeopcua").is_valid_endpointUrl;

module.exports.client_utils = require("lib/client/client_utils");

module.exports.DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;

// filtering tools
module.exports.constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;
module.exports.checkSelectClause = require("lib/tools/tools_event_filter").checkSelectClause;
module.exports.buildVariantArray = require("lib/datamodel/variant_tools").buildVariantArray;
module.exports.encode_decode = require("lib/misc/encode_decode");
module.exports.Enum = require("lib/misc/enum");
module.exports.factories = require("lib/misc/factories");

