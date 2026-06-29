/**
 * @module node-opcua-role-set-server
 *
 * Shared helper to raise an audit method event (a subtype of
 * AuditUpdateMethodEventType) on the Server Object.
 */
import type { UAObject } from "node-opcua-address-space";
import { NodeId } from "node-opcua-nodeid";
import type { Variant } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

export interface AuditMethodEventFields {
    /** The Node the audited operation acted on (Role / UserManagement Object). */
    sourceNode: NodeId;
    /** A short label, e.g. "Method/AddIdentity". */
    sourceName: string;
    /** The audited Method NodeId (omit for events not raised from a single Method call). */
    methodId?: NodeId;
    /** The Session user who invoked the Method. */
    clientUserId: string;
    /** TRUE when the operation succeeded. */
    status: boolean;
    /** Human-readable message (must NOT contain secrets such as passwords). */
    message: string;
    /**
     * The Method input arguments — include ONLY when they carry no secret
     * (e.g. an IdentityMappingRule). Omit for password-bearing Methods.
     */
    inputArguments?: Variant[];
}

/**
 * Raise `eventType` on the given Server Object with the standard
 * AuditUpdateMethodEventType fields. No-op if there is no Server Object.
 */
export function raiseAuditMethodEvent(serverObject: UAObject | undefined, eventType: string, fields: AuditMethodEventFields): void {
    if (!serverObject) {
        return;
    }
    serverObject.raiseEvent(eventType, {
        actionTimeStamp: { dataType: "DateTime", value: new Date() },
        status: { dataType: "Boolean", value: fields.status },
        serverId: { dataType: "String", value: "" },
        clientAuditEntryId: { dataType: "String", value: "" },
        clientUserId: { dataType: "String", value: fields.clientUserId },
        sourceNode: { dataType: "NodeId", value: fields.sourceNode },
        sourceName: { dataType: "String", value: fields.sourceName },
        methodId: { dataType: "NodeId", value: fields.methodId ?? NodeId.nullNodeId },
        severity: { dataType: "UInt16", value: 10 },
        message: { dataType: "LocalizedText", value: fields.message },
        inputArguments: { dataType: "Variant", arrayType: VariantArrayType.Array, value: fields.inputArguments ?? [] }
    });
}
