"use strict";

import * as  Enum from "lib/misc/enum";

process.env.NODE_PATH=__dirname + ";" + process.env.NODE_PATH;

//require('module').Module._initPaths();

//require("requirish")._(module); 

// common services
const structures       = require("lib/datamodel/structures");
const parseEndpointUrl = require("lib/nodeopcua").parseEndpointUrl;
const resolveNodeId    = require("lib/datamodel/nodeid").resolveNodeId;
const makeNodeId       = require("lib/datamodel/nodeid").makeNodeId;
const coerceNodeId     = require("lib/datamodel/nodeid").coerceNodeId;
const makeExpandedNodeId       = require("lib/datamodel/expanded_nodeid").makeExpandedNodeId;
const coerceExpandedNodeId     = require("lib/datamodel/expanded_nodeid").coerceExpandedNodeId;
const StatusCodes      = require("lib/datamodel/opcua_status_code").StatusCodes;
const DataType         = require("lib/datamodel/variant").DataType;
const DataValue        = require("lib/datamodel/datavalue").DataValue;
const Variant          = require("lib/datamodel/variant").Variant;
const VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
const NodeId           = require("lib/datamodel/nodeid").NodeId;
const NumericRange     = require("lib/datamodel/numeric_range").NumericRange;
const AccessLevelFlag  = require("lib/datamodel/access_level").AccessLevelFlag;

const LocalizedText       = require("lib/datamodel/localized_text").LocalizedText;
const coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
const QualifiedName       = require("lib/datamodel/qualified_name").QualifiedName;
const coerceQualifyName   = require("lib/datamodel/qualified_name").coerceQualifyName;

const Range               = require("lib/data_access/Range").Range;

//
const get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;
const makeApplicationUrn              = require("lib/misc/applicationurn").makeApplicationUrn;

const NodeClass = require("lib/datamodel/nodeclass").NodeClass;

// services
const browse_service                             = require("lib/services/browse_service");
const read_service                               = require("lib/services/read_service");
const write_service                              = require("lib/services/write_service");
const call_service                               = require("lib/services/call_service");
const session_service                            = require("lib/services/session_service");
const get_endpoints_service                      = require("lib/services/get_endpoints_service");
const subscription_service                       = require("lib/services/subscription_service");
const historizing_service                        = require("lib/services/historizing_service");
const register_server_service                    = require("lib/services/register_server_service");
const secure_channel_service                     = require("lib/services/secure_channel_service");
const translate_browse_paths_to_node_ids_service = require("lib/services/translate_browse_paths_to_node_ids_service");


const query_service           = require("lib/services/query_service");
const node_managment_service  = require("lib/services/node_management_service");


const EndpointDescription =  get_endpoints_service.EndpointDescription;

const utils              = require("lib/misc/utils");

const AttributeIds       = read_service.AttributeIds;
const AttributeNameById  = read_service.AttributeNameById;
const VariableTypeIds    = require("lib/opcua_node_ids").VariableTypeIds;
const VariableIds        = require("lib/opcua_node_ids").VariableIds;
const MethodIds          = require("lib/opcua_node_ids").MethodIds;
const ObjectIds          = require("lib/opcua_node_ids").ObjectIds;
const ObjectTypeIds      = require("lib/opcua_node_ids").ObjectTypeIds;
const ReferenceTypeIds   = require("lib/opcua_node_ids").ReferenceTypeIds;

const ApplicationType    = get_endpoints_service.ApplicationType;

// client services
import OPCUAClient from "lib/client/OPCUAClient";
const NodeCrawler        = require("lib/client/node_crawler").NodeCrawler;
const ClientSubscription = require("lib/client/client_subscription").ClientSubscription;
import ClientSession     from "lib/client/ClientSession";

// Server services
const OPCUAServer        = require("lib/server/opcua_server").OPCUAServer;
const OPCUADiscoveryServer = require("lib/server/opcua_discovery_server").OPCUADiscoveryServer;
const ServerEngine       = require("lib/server/server_engine").ServerEngine;
const generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
const AddressSpace       = require("lib/address_space/address_space").AddressSpace;
const ServerState        = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServerState_enum").ServerState;
const SecurityPolicy     = require("lib/misc/security_policy").SecurityPolicy;
const ServiceCounter     = require("_generated_/_auto_generated_ServiceCounter").ServiceCounter;
// basic opcua NodeClass
const UAObject  = require("lib/address_space/ua_object").UAObject;
const UAMethod  = require("lib/address_space/ua_method").UAMethod;
const UAVariable= require("lib/address_space/ua_variable").UAVariable;
const UADataType= require("lib/address_space/ua_data_type").UADataType;


const AnonymousIdentityToken = session_service.AnonymousIdentityToken;
const UserNameIdentityToken = session_service.UserNameIdentityToken;

//
const MessageSecurityMode = get_endpoints_service.MessageSecurityMode;

const makeRelativePath = require("lib/address_space/make_relative_path").makeRelativePath;


// DA
const standardUnits                  = require("lib/data_access/EUInformation").standardUnits;
const makeEUInformation              = require("lib/data_access/EUInformation").makeEUInformation;


// version
const version               = require("./package.json").version;
const standard_nodeset_file  = require("lib/server/server_engine").standard_nodeset_file;
const di_nodeset_filename    = require("lib/server/server_engine").di_nodeset_filename;
const adi_nodeset_filename   = require("lib/server/server_engine").adi_nodeset_filename;

// an incomplete but sufficient nodeset file used during testing
const mini_nodeset_filename  = require("lib/server/server_engine").mini_nodeset_filename;
const part8_nodeset_filename = require("lib/server/server_engine").part8_nodeset_filename;


const is_valid_endpointUrl = require("lib/nodeopcua").is_valid_endpointUrl;

const client_utils = require("lib/client/client_utils");

const DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;

// filtering tools
const constructEventFilter = require("lib/tools/tools_event_filter").constructEventFilter;
const checkSelectClause = require("lib/tools/tools_event_filter").checkSelectClause;
const buildVariantArray = require("lib/datamodel/variant_tools").buildVariantArray;
const encode_decode = require("lib/misc/encode_decode");

const factories = require("lib/misc/factories");

export {
  structures,
  parseEndpointUrl,
  resolveNodeId,
  makeNodeId,
  coerceNodeId,
  makeExpandedNodeId,
  coerceExpandedNodeId,
  StatusCodes,
  DataType,
  DataValue,
  Variant,
  VariantArrayType,
  NodeId,
  NumericRange,
  AccessLevelFlag,

  LocalizedText,
  coerceLocalizedText,
  QualifiedName,
  coerceQualifyName,

  Range,


  get_fully_qualified_domain_name,
  makeApplicationUrn,

  NodeClass,

// services
  browse_service,
  read_service,
  write_service,
  call_service,
  session_service,
  get_endpoints_service,
  subscription_service,
  historizing_service,
  register_server_service,
  secure_channel_service,
  translate_browse_paths_to_node_ids_service,


  query_service,
  node_managment_service,


  EndpointDescription,

  utils,

  AttributeIds,
  AttributeNameById,
  VariableTypeIds,
  VariableIds,
  MethodIds,
  ObjectIds,
  ObjectTypeIds,
  ReferenceTypeIds,

  ApplicationType,

// client services
  OPCUAClient,
  NodeCrawler,
  ClientSubscription,
  ClientSession,

// Server services
  OPCUAServer,
  OPCUADiscoveryServer,
  ServerEngine,
  generate_address_space,
  AddressSpace,
  ServerState,
  SecurityPolicy,
  ServiceCounter,
// basic opcua NodeClass
  UAObject,
  UAMethod,
  UAVariable,
  UADataType,


  AnonymousIdentityToken,
  UserNameIdentityToken,

//
  MessageSecurityMode,

  makeRelativePath,


// DA
  standardUnits,
  makeEUInformation,


// version
  version,
  standard_nodeset_file,
  di_nodeset_filename,
  adi_nodeset_filename,

// an incomplete but sufficient nodeset file used during testing
  mini_nodeset_filename,
  part8_nodeset_filename,


  is_valid_endpointUrl,

  client_utils,

  DataTypeIds,

// filtering tools
  constructEventFilter,
  checkSelectClause,
  buildVariantArray,
  encode_decode,

  Enum,
  factories
};


export default {
  structures,
  parseEndpointUrl,
  resolveNodeId,
  makeNodeId,
  coerceNodeId,
  makeExpandedNodeId,
  coerceExpandedNodeId,
  StatusCodes,
  DataType,
  DataValue,
  Variant,
  VariantArrayType,
  NodeId,
  NumericRange,
  AccessLevelFlag,

  LocalizedText,
  coerceLocalizedText,
  QualifiedName,
  coerceQualifyName,

  Range,


  get_fully_qualified_domain_name,
  makeApplicationUrn,

  NodeClass,

// services
  browse_service,
  read_service,
  write_service,
  call_service,
  session_service,
  get_endpoints_service,
  subscription_service,
  historizing_service,
  register_server_service,
  secure_channel_service,
  translate_browse_paths_to_node_ids_service,


  query_service,
  node_managment_service,


  EndpointDescription,

  utils,

  AttributeIds,
  AttributeNameById,
  VariableTypeIds,
  VariableIds,
  MethodIds,
  ObjectIds,
  ObjectTypeIds,
  ReferenceTypeIds,

  ApplicationType,

// client services
  OPCUAClient,
  NodeCrawler,
  ClientSubscription,
  ClientSession,

// Server services
  OPCUAServer,
  OPCUADiscoveryServer,
  ServerEngine,
  generate_address_space,
  AddressSpace,
  ServerState,
  SecurityPolicy,
  ServiceCounter,
// basic opcua NodeClass
  UAObject,
  UAMethod,
  UAVariable,
  UADataType,


  AnonymousIdentityToken,
  UserNameIdentityToken,

//
  MessageSecurityMode,

  makeRelativePath,


// DA
  standardUnits,
  makeEUInformation,


// version
  version,
  standard_nodeset_file,
  di_nodeset_filename,
  adi_nodeset_filename,

// an incomplete but sufficient nodeset file used during testing
  mini_nodeset_filename,
  part8_nodeset_filename,


  is_valid_endpointUrl,

  client_utils,

  DataTypeIds,

// filtering tools
  constructEventFilter,
  checkSelectClause,
  buildVariantArray,
  encode_decode,

  Enum,
  factories
};