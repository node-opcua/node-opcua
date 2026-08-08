/**
 * @module node-opcua-alias-name-server
 *
 * `AddAliasesToCategory` (clause 6.3.4) and `DeleteAliasesFromCategory`
 * (clause 6.3.5) — the *AliasName Configuration Support* facet, CU 5874.
 *
 * Both report **per item**: the Method itself succeeds and an `ErrorCodes` array
 * parallel to `AliasNames` says what happened to each one. A single bad entry
 * does not fail the call, which is why the store interface returns
 * `StatusCode[]` rather than throwing.
 */

import type { ISessionContext, UAMethod, UAObject } from "node-opcua-address-space-base";
import type { AliasEntry, IAliasStore } from "node-opcua-alias-name-common";
import { type ExpandedNodeId, type NodeId, NodeId as NodeIdClass } from "node-opcua-nodeid";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, type Variant, VariantArrayType } from "node-opcua-variant";
import { ALIAS_FOR } from "./well_known.js";

export interface ConfigurationBindingOptions {
    /** The store that performs the mutation. Must implement `add` / `delete`. */
    store: IAliasStore;
    /**
     * Write gate (clause 6.3.4 Table 11 / 6.3.5 Table 15). **Defaults to denying
     * everyone** — the write surface is the one place a permissive default would
     * be a security defect rather than a convenience.
     */
    isWriteAllowed?: (context: ISessionContext, categoryNodeId: NodeId) => boolean | Promise<boolean>;
    /** Called after a successful mutation so `LastChange` can move. */
    onChanged?: (categoryNodeId: NodeId) => void | Promise<void>;
}

/** Read a String[] argument, tolerating null for "empty". */
function readStringArray(inputArguments: Variant[], index: number): string[] | null {
    const value = inputArguments?.[index]?.value;
    if (value === null || value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        return null;
    }
    return value.map((v) => (typeof v === "string" ? v : String(v)));
}

/** Read an ExpandedNodeId[] argument, tolerating null for "empty". */
function readNodeIdArray(inputArguments: Variant[], index: number): ExpandedNodeId[] | null {
    const value = inputArguments?.[index]?.value;
    if (value === null || value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        return null;
    }
    return value as ExpandedNodeId[];
}

/** Build the OutputArguments Variant for an ErrorCodes array. */
function errorCodesResult(codes: StatusCode[]): CallMethodResultOptions {
    return {
        statusCode: StatusCodes.Good,
        outputArguments: [
            {
                dataType: DataType.StatusCode,
                arrayType: VariantArrayType.Array,
                value: codes
            }
        ]
    };
}

/**
 * Handler for `AddAliasesToCategory` (clause 6.3.4).
 *
 * Table 11 governs the *call*: `Bad_InvalidArgument` when an argument is the
 * wrong type, when the arrays other than `TargetServers` differ in length, or
 * when all arrays are empty. Table 10 governs each *item*.
 */
export function makeAddAliasesToCategoryHandler(options: ConfigurationBindingOptions) {
    return async function addAliasesToCategoryHandler(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const category = this.parent as UAObject | null;
        if (!category) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        // clause 6.3.4 Table 11
        if (!(await isWriteAllowed(options, context, category.nodeId))) {
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }

        const aliasNames = readStringArray(inputArguments, 0);
        const targetNodes = readNodeIdArray(inputArguments, 1);
        const targetServers = readStringArray(inputArguments, 2);
        const targetReferenceTypeRaw = inputArguments?.[3]?.value;

        if (aliasNames === null || targetNodes === null || targetServers === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        // "the size of the arrays for all arguments except TargetServers is not
        // the same" - TargetServers is excluded because Table 9 lets it be null
        // or empty to mean "all local"
        if (aliasNames.length !== targetNodes.length) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        // "or if all arrays are empty"
        if (aliasNames.length === 0) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        if (targetServers.length !== 0 && targetServers.length !== aliasNames.length) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        // Table 9: "If null, it defaults to AliasFor."
        const referenceTypeId =
            targetReferenceTypeRaw instanceof NodeIdClass && !targetReferenceTypeRaw.isEmpty() ? targetReferenceTypeRaw : ALIAS_FOR;

        const entries: AliasEntry[] = aliasNames.map((aliasName, i) => {
            // Table 9: "The ServerIndex in the ExpandedNodeId shall be ignored
            // and the TargetServers Uri shall be used."
            const serverUri = targetServers[i] ? targetServers[i] : null;
            return {
                aliasName,
                referencedNodes: [targetNodes[i]],
                serverUris: [serverUri],
                categoryNodeId: category.nodeId,
                referenceTypeIds: [referenceTypeId]
            };
        });

        if (!options.store.add) {
            // a read-only store: every item is unsupported, but the call itself
            // succeeded in reporting that
            return errorCodesResult(entries.map(() => StatusCodes.BadNotSupported));
        }

        const codes = await options.store.add(category.nodeId, entries);
        if (codes.some((code) => code.isGood())) {
            await options.onChanged?.(category.nodeId);
        }
        return errorCodesResult(codes);
    };
}

/**
 * Handler for `DeleteAliasesFromCategory` (clause 6.3.5).
 *
 * Table 15 governs the call: unlike Add, **every** array must be the same
 * length — "the size of the arrays for all arguments is not the same", with no
 * exception, because there is no `TargetServers` here.
 */
export function makeDeleteAliasesFromCategoryHandler(options: ConfigurationBindingOptions) {
    return async function deleteAliasesFromCategoryHandler(
        this: UAMethod,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> {
        const category = this.parent as UAObject | null;
        if (!category) {
            return { statusCode: StatusCodes.BadInternalError };
        }

        if (!(await isWriteAllowed(options, context, category.nodeId))) {
            return { statusCode: StatusCodes.BadUserAccessDenied };
        }

        const aliasNames = readStringArray(inputArguments, 0);
        const targetNodes = readNodeIdArray(inputArguments, 1);

        if (aliasNames === null || targetNodes === null) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        if (aliasNames.length === 0) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }
        // Table 13: "The length of each of the arrays shall be the same." A null
        // TargetNodes array is the documented way to say "every target", so an
        // empty array is accepted and expanded.
        if (targetNodes.length !== 0 && targetNodes.length !== aliasNames.length) {
            return { statusCode: StatusCodes.BadInvalidArgument };
        }

        const entries = aliasNames.map((aliasName, i) => {
            // "If the TargetNodes array entry is null or empty, all AliasNames
            // with the provided name are deleted from the AliasNameCategory."
            const target = targetNodes[i];
            const referencedNodes = target && !target.isEmpty() ? [target] : [];
            return { aliasName, referencedNodes };
        });

        if (!options.store.delete) {
            return errorCodesResult(entries.map(() => StatusCodes.BadNotSupported));
        }

        const codes = await options.store.delete(category.nodeId, entries);
        if (codes.some((code) => code.isGood())) {
            await options.onChanged?.(category.nodeId);
        }
        return errorCodesResult(codes);
    };
}

/** The write gate, defaulting to deny. */
async function isWriteAllowed(
    options: ConfigurationBindingOptions,
    context: ISessionContext,
    categoryNodeId: NodeId
): Promise<boolean> {
    if (!options.isWriteAllowed) {
        // Writing is off unless the Server says who may do it. OPC 10000-17
        // defines no security model at all, so there is no safe default rule to
        // fall back on - only a safe default answer.
        return false;
    }
    return await options.isWriteAllowed(context, categoryNodeId);
}
