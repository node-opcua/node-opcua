/**
 * @module bode-opcua-client
 */
import { SecurityPolicy } from "node-opcua-secure-channel";
import * as browse_service1 from "node-opcua-service-browse";
import * as call_service1 from "node-opcua-service-call";
import * as discovery_service1 from "node-opcua-service-discovery";
import * as endpoints_service1 from "node-opcua-service-endpoints";
import * as historizing_service1 from "node-opcua-service-history";
import * as query_service1 from "node-opcua-service-query";
import * as read_service1 from "node-opcua-service-read";
import * as secure_channel_service1 from "node-opcua-service-secure-channel";
import * as session_service1 from "node-opcua-service-session";
import * as subscription_service1 from "node-opcua-service-subscription";
import * as translate_browse_paths_to_node_ids_service1 from "node-opcua-service-translate-browse-path";
import * as write_service1 from "node-opcua-service-write";


export * from "./client_base";
export * from "./opcua_client";
export * from "./client_session";
export * from "./client_subscription";
export * from "./client_monitored_item_base";
export * from "./client_monitored_item";
export * from "./client_monitored_item_group";
export * from "./client_publish_engine";
export * from "./alarms_and_conditions/client_tools";
export * from "./tools/findservers";
export * from "./tools/read_history_server_capabilities";
export * from "./client_utils";

///
export { ClientSecureChannelLayer } from "node-opcua-secure-channel";
export {
    NodeId, resolveNodeId, makeNodeId, coerceNodeId, sameNodeId,
    ExpandedNodeId, makeExpandedNodeId, coerceExpandedNodeId
} from "node-opcua-nodeid";
export { StatusCode } from "node-opcua-status-code";
export * from "node-opcua-variant";
export * from "node-opcua-data-value";
export * from "node-opcua-data-model";
export * from "node-opcua-constants";

export { makeApplicationUrn } from "node-opcua-common";
export { get_fully_qualified_domain_name } from "node-opcua-hostname";



export const browse_service = browse_service1;
export const read_service = read_service1;
export const write_service = write_service1;
export const call_service = call_service1;
export const session_service = session_service1;
export const endpoints_service = endpoints_service1;
export const subscription_service = subscription_service1;
export const historizing_service = historizing_service1;
export const discovery_service = discovery_service1;
export const secure_channel_service = secure_channel_service1;
export const translate_browse_paths_to_node_ids_service = translate_browse_paths_to_node_ids_service1;
export const query_service = query_service1;


module.exports.AnonymousIdentityToken = module.exports.session_service.AnonymousIdentityToken;
module.exports.UserNameIdentityToken = module.exports.session_service.UserNameIdentityToken;


export {
    EndpointDescription, ApplicationType
} from "node-opcua-service-endpoints";


export { BrowsePath, makeRelativePath, makeBrowsePath } from "node-opcua-service-translate-browse-path";

export { ServerState, ServiceCounterDataType } from "node-opcua-common";
export { MessageSecurityMode } from "node-opcua-service-secure-channel";
export { SecurityPolicy } from "node-opcua-secure-channel";

import * as utils1 from "node-opcua-utils";

export const utils = utils1;
import * as crypto_util1 from "node-opcua-crypto";

export const crypto_utils = crypto_util1;
export { hexDump } from "node-opcua-debug";

/*
module.exports = {

    OPCUAClientBase: require("./src/client_base").OPCUAClientBase,

    OPCUAClient:   require("./src/opcua_client").OPCUAClient,

    ClientSession: require("./src/client_session").ClientSession,

    ClientSubscription: require("./src/client_subscription").ClientSubscription,

    ClientSecureChannelLayer: require("node-opcua-secure-channel").ClientSecureChannelLayer,

    // tools
    perform_findServers: require("./src/tools/findservers").perform_findServers,
    perform_findServersOnNetwork: require("./src/tools/findservers").perform_findServersOnNetwork,
    readHistorySeverCapabilities: require("./src/tools/read_history_server_capabilities").readHistoryServerCapabilities

};

module.exports.NodeId = require("node-opcua-nodeid").NodeId;
module.exports.resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
module.exports.makeNodeId = require("node-opcua-nodeid").makeNodeId;
module.exports.coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
module.exports.sameNodeId = require("node-opcua-nodeid").sameNodeId;

module.exports.ExpandedNodeId = require("node-opcua-nodeid").ExpandedNodeId;
module.exports.makeExpandedNodeId = require("node-opcua-nodeid").makeExpandedNodeId;
module.exports.coerceExpandedNodeId = require("node-opcua-nodeid").coerceExpandedNodeId;

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
module.exports.coerceQualifiedName = require("node-opcua-data-model").coerceQualifiedName;
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
module.exports.discovery_service = require("node-opcua-service-discovery");
module.exports.secure_channel_service = require("node-opcua-service-secure-channel");

module.exports.translate_browse_paths_to_node_ids_service = require("node-opcua-service-translate-browse-path");
module.exports.BrowsePath = require("node-opcua-service-translate-browse-path").BrowsePath;
module.exports.makeRelativePath = require("node-opcua-service-translate-browse-path").makeRelativePath;
module.exports.makeBrowsePath = require("node-opcua-service-translate-browse-path").makeBrowsePath;

module.exports.query_service = require("node-opcua-service-query");


module.exports.ServerState = require("node-opcua-common").ServerState;
module.exports.ServiceCounterDataType = require("node-opcua-common").ServiceCounterDataType;

module.exports.SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
module.exports.MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

module.exports.utils = require("node-opcua-utils");
module.exports.crypto_utils = require("node-opcua-crypto");
module.exports.hexDump = require("node-opcua-debug").hexDump;

//xx module.exports.Enum                      = require("node-opcua-enum");
//xx module.exports.NumericRange              = require("node-opcua-numeric-range").NumericRange;
// DA
//xx module.exports.standardUnits             = require("node-opcua-data-access").standardUnits;
//xx module.exports.makeEUInformatio          = require("node-opcua-data-access").makeEUInformation;
//xx module.exports.Range                     = require("node-opcua-data-access").Range;
//xx module.exports.register_node_service                      = require("node-opcua-service-register-node");
//xx module.exports.node_managment_service                     = require("node-opcua-service-node-management");

*/