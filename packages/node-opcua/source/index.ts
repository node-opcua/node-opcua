/*!
 * The MIT License (MIT)
 * Copyright (c) 2022-2025  Sterfive SAS - 833264583 RCS ORLEANS - France  (https://www.sterfive.com)
 * Copyright (c) 2014-2022 Etienne Rossignon
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * @module node-opcua
 */

import chalk from "chalk";
import semver from "semver";

const minimumNodeJsVersionRequired = ">=16.7.0"; // minimum

// c8 ignore next
if (typeof process === "object" && !semver.satisfies(process.version, minimumNodeJsVersionRequired)) {
    console.log(
        chalk.cyan(
            `warning node-opcua: Required nodejs version ${minimumNodeJsVersionRequired} not satisfied with current nodejs version ${process.version}.`
        )
    );
}

export * from "node-opcua-address-space/nodeJS";
// an incomplete but sufficient nodeset file used during testing
export { get_empty_nodeset_filename, get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
export { assert } from "node-opcua-assert";
// basic_types
export * from "node-opcua-basic-types";
export { BinaryStream } from "node-opcua-binary-stream";
export * from "node-opcua-common";
export {
    AggregateFunction,
    DataTypeIds,
    MethodIds,
    ObjectIds,
    ObjectTypeIds,
    ReferenceTypeIds,
    VariableIds,
    VariableTypeIds
} from "node-opcua-constants";
// DA
export { makeEUInformation, Range, standardUnits } from "node-opcua-data-access";
export {
    AccessLevelFlag,
    AttributeIds,
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    DiagnosticInfo,
    LocalizedText,
    makeAccessLevelFlag,
    NodeClass,
    NodeClassMask,
    QualifiedName
} from "node-opcua-data-model";
export { DataValue, sameDataValue } from "node-opcua-data-value";
export * from "node-opcua-hostname";
export {
    coerceExpandedNodeId,
    coerceNodeId,
    ExpandedNodeId,
    makeExpandedNodeId,
    makeNodeId,
    NodeId,
    NodeIdLike,
    NodeIdType,
    resolveNodeId,
    sameNodeId
} from "node-opcua-nodeid";
// -----------------------------------------------------------------------------
// Nodeset stuff
// -----------------------------------------------------------------------------
export { nodesets } from "node-opcua-nodesets";
export { NumericRange } from "node-opcua-numeric-range";

// services
export * from "node-opcua-service-browse";
export * from "node-opcua-service-call";
// export * from "node-opcua-service-history";
export * from "node-opcua-service-discovery";
export * from "node-opcua-service-endpoints";
export * from "node-opcua-service-node-management";
export * from "node-opcua-service-query";
export * from "node-opcua-service-read";
export * from "node-opcua-service-register-node";
export * from "node-opcua-service-secure-channel";
export * from "node-opcua-service-session";
export * from "node-opcua-service-subscription";
export * from "node-opcua-service-translate-browse-path";
export * from "node-opcua-service-write";
export { StatusCode, StatusCodes } from "node-opcua-status-code";
export * from "node-opcua-utils";
export { buildVariantArray, DataType, Variant, VariantArrayType } from "node-opcua-variant";

// `import * as` rather than require(): node-opcua-utils is compiled TypeScript and so
// carries __esModule, which means __importStar returns the module object untouched. The
// exported shape is therefore identical to what require() produced.
import * as utils from "node-opcua-utils";

export * from "node-opcua-aggregates";
// ----------------------------------------------------------------------------------------------------------
// client services
// ----------------------------------------------------------------------------------------------------------
export * from "node-opcua-client";
export { hexDump, LogLevel, setDebugLogger, setErrorLogger, setLogLevel, setWarningLogger } from "node-opcua-debug";
// filtering tools
export * from "node-opcua-service-filter";
// filtering tools
export * from "node-opcua-transport";
export { is_valid_endpointUrl, parseEndpointUrl } from "node-opcua-transport";
// ----------------------------------------------------------------------------------------------------------
// server management
// ----------------------------------------------------------------------------------------------------------
export * from "./server-stuff";
export { utils };
