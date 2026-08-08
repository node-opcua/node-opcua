/**
 * @module node-opcua-alias-name-client
 */

import type { NodeId } from "node-opcua-nodeid";
import type { StatusCode } from "node-opcua-status-code";

/**
 * The Server does not expose the Method that was asked for.
 *
 * `FindAlias` is MANDATORY on every `AliasNameCategoryType` instance, but
 * `FindAliasVerbose`, `AddAliasesToCategory` and `DeleteAliasesFromCategory` are
 * all optional (OPC 10000-17 clause 6.3). A Server that implements only the
 * mandatory Method is perfectly conformant, so a Client that wants the verbose
 * form must be able to tell "this Server does not offer it" apart from "the call
 * failed".
 *
 * Raised before any call is made — the Method's absence is discovered while
 * resolving NodeIds — so it never surfaces as an unhandled `Bad_NotImplemented`
 * from the wire.
 */
export class AliasNameMethodNotSupportedError extends Error {
    /** The Method that is missing, by BrowseName. */
    public readonly methodName: string;
    /** The category it was looked for on. */
    public readonly categoryNodeId: NodeId;

    constructor(methodName: string, categoryNodeId: NodeId) {
        super(
            `the Server does not expose ${methodName} on ${categoryNodeId.toString()}. ` +
                "Only FindAlias is mandatory in OPC 10000-17 clause 6.3; the rest are optional."
        );
        this.name = "AliasNameMethodNotSupportedError";
        this.methodName = methodName;
        this.categoryNodeId = categoryNodeId;
    }
}

/**
 * The Server answered a `FindAlias` call with a bad StatusCode.
 *
 * Carries the code so a caller can distinguish the cases clause 6.3.2 Table 4
 * defines — `Bad_InvalidArgument` for a malformed search pattern,
 * `Bad_ResponseTooLarge` for a result set that needs a narrower filter,
 * `Bad_UserAccessDenied` for a category the session may not read.
 */
export class AliasNameCallError extends Error {
    public readonly statusCode: StatusCode;
    public readonly categoryNodeId: NodeId;

    constructor(methodName: string, categoryNodeId: NodeId, statusCode: StatusCode) {
        super(`${methodName} on ${categoryNodeId.toString()} failed with ${statusCode.toString()}`);
        this.name = "AliasNameCallError";
        this.statusCode = statusCode;
        this.categoryNodeId = categoryNodeId;
    }
}
