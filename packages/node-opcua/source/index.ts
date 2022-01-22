/**
 * @module node-opcua
 */
// tslint:disable:max-line-length
// tslint:disable:no-var-requires
// tslint:disable:no-console
// tslint:disable:variable-name

import * as chalk from "chalk";

const semver = require("semver");
const minimumNodeVersionRequired = ">=8.0.0"; // minimum

// istanbul ignore next
if (typeof process === "object" && !semver.satisfies(process.version, minimumNodeVersionRequired)) {
    console.log(
        chalk.cyan(
            `warning node-opcua: Required nodejs version ${minimumNodeVersionRequired} not satisfied with current nodejs version ${process.version}.`
        )
    );
}

export * from "node-opcua-common";

export { assert } from "node-opcua-assert";
export { BinaryStream } from "node-opcua-binary-stream";

export * from "node-opcua-utils";

export {
    NodeId,
    NodeIdLike,
    resolveNodeId,
    makeNodeId,
    coerceNodeId,
    sameNodeId,
    NodeIdType,
    ExpandedNodeId,
    makeExpandedNodeId,
    coerceExpandedNodeId
} from "node-opcua-nodeid";

export { StatusCode, StatusCodes } from "node-opcua-status-code";
export {
    VariableTypeIds,
    VariableIds,
    MethodIds,
    ObjectIds,
    ObjectTypeIds,
    ReferenceTypeIds,
    DataTypeIds,
    AggregateFunction
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
    BrowseDirection
} from "node-opcua-data-model";

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
// export * from "node-opcua-service-history";
export * from "node-opcua-service-discovery";
export * from "node-opcua-service-secure-channel";
export * from "node-opcua-service-translate-browse-path";
export * from "node-opcua-service-query";
export * from "node-opcua-service-node-management";
export { DiagnosticInfo } from "node-opcua-data-model";

// -----------------------------------------------------------------------------
// Nodeset stuff
// -----------------------------------------------------------------------------
export { nodesets } from "node-opcua-nodesets";
// an incomplete but sufficient nodeset file used during testing
export { get_empty_nodeset_filename, get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
export * from "node-opcua-address-space/nodeJS";
module.exports.utils = require("node-opcua-utils");
module.exports.hexDump = require("node-opcua-debug").hexDump;

// ----------------------------------------------------------------------------------------------------------
// client services
// ----------------------------------------------------------------------------------------------------------
export * from "node-opcua-client";
export * from "node-opcua-client-proxy";
export * from "node-opcua-client-crawler";
export { parseEndpointUrl, is_valid_endpointUrl } from "node-opcua-transport";

// ----------------------------------------------------------------------------------------------------------
// server management
// ----------------------------------------------------------------------------------------------------------
export * from "./server-stuff";
// filtering tools
export * from "node-opcua-service-filter";

// filtering tools
export * from "node-opcua-transport";

export { OPCUADiscoveryServer } from "node-opcua-server-discovery";

export { build_address_space_for_conformance_testing } from "node-opcua-address-space-for-conformance-testing";
export { install_optional_cpu_and_memory_usage_node } from "node-opcua-vendor-diagnostic";

export * from "node-opcua-aggregates";
export { makeBoiler } from "node-opcua-address-space/testHelpers";
