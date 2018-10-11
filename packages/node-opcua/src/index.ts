import chalk from "chalk";

const semver = require("semver");
const version = require("../package").engines.node;
if (!semver.satisfies(process.version, version)) {
    console.log(
        chalk.cyan(`warning node-opcua: Required nodejs version ${version} not satisfied with current nodejs version ${
            process.version
            }.`));
}

export {
    NodeId,
    resolveNodeId,
    makeNodeId,
    coerceNodeId,
    sameNodeId,
    NodeIdType,
    ExpandedNodeId,
    makeExpandedNodeId,
    coerceExpandedNodeId
} from "node-opcua-nodeid";

export {
    StatusCode
} from "node-opcua-status-code";
export {
    StatusCodes,
    VariableTypeIds,
    VariableIds,
    MethodIds,
    ObjectIds,
    ObjectTypeIds,
    ReferenceTypeIds,
    DataTypeIds,
} from "node-opcua-constants";

export { DataType, Variant, VariantArrayType, buildVariantArray } from "node-opcua-variant";
export { DataValue, sameDataValue } from "node-opcua-data-value";
export { NumericRange } from "node-opcua-numeric-range";

export {
    AccessLevelFlag,
    makeAccessLevelFlag,
    LocalizedText,
    coerceLocalizedText,
    QualifiedName,
    coerceQualifiedName,
    NodeClass,
    NodeClassMask,
    AttributeIds,
    BrowseDirection,
} from "node-opcua-data-model";

export * from "node-opcua-common";

// basic_types
export * from "node-opcua-basic-types";

// DA
export { standardUnits, makeEUInformation, Range } from "node-opcua-data-access";
export * from "node-opcua-hostname";

// services
export * from "node-opcua-service-browse";
export * from "node-opcua-service-read";
export * from "node-opcua-service-write";
export * from "node-opcua-service-call";
export * from "node-opcua-service-session";
export * from "node-opcua-service-register-node";
export * from "node-opcua-service-endpoints";
export * from "node-opcua-service-subscription";
export * from "node-opcua-service-history";
export * from "node-opcua-service-discovery";
export * from "node-opcua-service-secure-channel";
export * from "node-opcua-service-translate-browse-path";
export * from "node-opcua-service-query";
export * from "node-opcua-service-node-management";

export * from "node-opcua-secure-channel";

module.exports.utils = require("node-opcua-utils");
module.exports.crypto_utils = require("node-opcua-crypto");
module.exports.hexDump = require("node-opcua-debug").hexDump;

// ----------------------------------------------------------------------------------------------------------
// client services
// ----------------------------------------------------------------------------------------------------------
module.exports.OPCUAClient = require("node-opcua-client").OPCUAClient;
module.exports.OPCUAClientBase = require("node-opcua-client").OPCUAClientBase;

module.exports.NodeCrawler = require("node-opcua-client-crawler").NodeCrawler;
module.exports.ClientSubscription = require("node-opcua-client").ClientSubscription;

// module.exports.ClientSession = require("node-opcua-client").ClientSession;
// Xx module.exports.client_utils = require("node-opcua-client/src");

module.exports.perform_findServers = require("node-opcua-client").perform_findServers;
module.exports.perform_findServersOnNetwork = require("node-opcua-client").perform_findServersOnNetwork;
module.exports.readHistoryServerCapabilities = require("node-opcua-client").readHistoryServerCapabilities;

module.exports.callConditionRefresh = require("node-opcua-client").callConditionRefresh;
module.exports.readUAAnalogItem = require("node-opcua-client").readUAAnalogItem;

module.exports.parseEndpointUrl = require("node-opcua-transport").parseEndpointUrl;

// ---------------------------------------------------------------------------------------------------------------------
// Server services
// ---------------------------------------------------------------------------------------------------------------------
module.exports.OPCUAServer = require("node-opcua-server").OPCUAServer;
module.exports.RegisterServerMethod = require("node-opcua-server").RegisterServerMethod;

module.exports.ServerEngine = require("node-opcua-server").ServerEngine;
module.exports.MonitoredItem = require("node-opcua-server").MonitoredItem;
module.exports.ServerSession = require("node-opcua-server").ServerSession;
module.exports.Subscription = require("node-opcua-server").Subscription;
module.exports.MonitoredItem = require("node-opcua-server").MonitoredItem;

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



module.exports.nodesets = require("node-opcua-nodesets");
module.exports.constructNodesetFilename = module.exports.nodesets.constructNodesetFilename;
module.exports.standard_nodeset_file = module.exports.nodesets.standard_nodeset_file;
module.exports.di_nodeset_filename = module.exports.nodesets.di_nodeset_filename;
module.exports.adi_nodeset_filename = module.exports.nodesets.adi_nodeset_filename;

// an incomplete but sufficient nodeset file used during testing
module.exports.mini_nodeset_filename = require("node-opcua-address-space/test_helpers/get_mini_address_space").mini_nodeset_filename;
module.exports.empty_nodeset_filename = require("node-opcua-address-space/test_helpers/get_mini_address_space").empty_nodeset_filename;

module.exports.is_valid_endpointUrl = require("node-opcua-transport").is_valid_endpointUrl;

// filtering tools
module.exports.checkSelectClause = require("node-opcua-address-space").checkSelectClause;
module.exports.constructEventFilter = require("node-opcua-service-filter").constructEventFilter;

const address_space_for_conformance_testing = require("node-opcua-address-space-for-conformance-testing");
module.exports.build_address_space_for_conformance_testing =
    address_space_for_conformance_testing.build_address_space_for_conformance_testing;

module.exports.install_optional_cpu_and_memory_usage_node = require("node-opcua-vendor-diagnostic").install_optional_cpu_and_memory_usage_node;
module.exports.construct_demo_alarm_in_address_space = require("node-opcua-address-space/test_helpers/alarms_and_conditions_demo").construct_demo_alarm_in_address_space;

module.exports.createBoilerType = require("node-opcua-address-space/test_helpers/boiler_system").createBoilerType;
module.exports.makeBoiler = require("node-opcua-address-space/test_helpers/boiler_system").makeBoiler;

module.exports.UAProxyManager = require("node-opcua-client-proxy").UAProxyManager;
