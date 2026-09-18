/**
 * @module node-opcua-server
 */
import {
    type BaseNode,
    type IAddressSpace,
    type IEventData,
    type ISessionContext,
    makeRoles,
    type RoleIdLike,
    WellKnownRoles
} from "node-opcua-address-space";
import { ObjectTypeIds } from "node-opcua-constants";
import { BrowseDirection, PermissionFlag } from "node-opcua-data-model";
import { type NodeId, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { PermissionType, type RolePermissionTypeOptions } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";

/**
 * The Roles that receive Audit Events when OPCUAServerOptions.auditEventRoles is not given.
 *
 * OPC 10000-2 v1.05.06 §4.14: "the ability to subscribe for Audit Events is restricted to appropriate users
 * and/or applications". OPC 10000-3 v1.05.06 §4.9.2 describes SecurityAdmin as the Role "allowed to change
 * security related settings", the one an audit trail of sessions, certificates and identities
 * belongs to.
 */
export const defaultAuditEventRoles: RoleIdLike[] = [WellKnownRoles.SecurityAdmin];

/**
 * What every Session may do on an AuditEventType node: browse and read it. This is what
 * Opc.Ua.NodeSet2.xml (1.05) declares for the Anonymous Role on AuditEventType and each of its
 * standard subtypes (Permissions="33"), and the Anonymous Role is added to every Session by
 * permission evaluation (see SessionContext). Used for a subtype that declares no RolePermissions.
 */
const auditEventTypeBrowsePermissions = PermissionFlag.Browse | PermissionFlag.Read;

function collectSubtypes(typeNode: BaseNode, result: BaseNode[]): void {
    result.push(typeNode);
    for (const subtype of typeNode.findReferencesExAsObject("HasSubtype", BrowseDirection.Forward)) {
        collectSubtypes(subtype, result);
    }
}

/**
 * Makes `roles` the only Roles holding ReceiveEvents on AuditEventType and on every subtype loaded so
 * far, so that event MonitoredItems deliver Audit Events to their Sessions alone (OPC 10000-2 v1.05.06 §6.7:
 * "Administrative AccessRestrictions should also be used to control Audit Events").
 *
 * Only the ReceiveEvents bit is rewritten: every other permission a type declares stays as its
 * nodeset wrote it. Opc.Ua.NodeSet2.xml already grants ReceiveEvents to SecurityAdmin alone on the
 * standard audit types, so the default leaves those unchanged; a subtype that declares nothing
 * (several companion "...AuditEventType"s do) gets the same shape: Browse and Read for every Session,
 * ReceiveEvents for `roles`. A subtype added after this runs (Namespace.addEventType) is not covered
 * and needs RolePermissions of its own.
 *
 * Naming the Anonymous Role hands Audit Events to every Session again.
 *
 * @returns the number of type nodes whose RolePermissions were written
 */
export function restrictAuditEventReception(addressSpace: IAddressSpace, roles: RoleIdLike[]): number {
    const auditEventType = addressSpace.findNode(resolveNodeId(ObjectTypeIds.AuditEventType));
    if (!auditEventType) {
        return 0;
    }
    const roleIds: NodeId[] = makeRoles(roles, addressSpace);
    const anonymousRoleId = resolveNodeId(WellKnownRoles.Anonymous);

    const types: BaseNode[] = [];
    collectSubtypes(auditEventType, types);
    for (const typeNode of types) {
        const declared: RolePermissionTypeOptions[] = typeNode.rolePermissions ?? [
            { roleId: anonymousRoleId, permissions: auditEventTypeBrowsePermissions }
        ];
        const rolePermissions = declared.map(({ roleId, permissions }) => ({
            roleId,
            permissions: (permissions ?? PermissionFlag.None) & ~PermissionFlag.ReceiveEvents
        }));
        for (const roleId of roleIds) {
            const entry = rolePermissions.find(
                (r) => r.roleId !== undefined && r.roleId !== null && sameNodeId(resolveNodeId(r.roleId), roleId)
            );
            if (entry) {
                entry.permissions |= PermissionFlag.ReceiveEvents;
            } else {
                rolePermissions.push({ roleId, permissions: auditEventTypeBrowsePermissions | PermissionFlag.ReceiveEvents });
            }
        }
        typeNode.setRolePermissions(rolePermissions);
    }
    return types.length;
}

interface IEventDataWithSourceNode {
    sourceNode?: Variant;
}

/**
 * OPC 10000-3 PermissionType: "ReceiveEvents, bit 11: A Client only receives an Event if this bit is
 * set on the Node identified by the EventTypeId field and on the Node identified by the SourceNode
 * field."
 *
 * Evaluated with the Session's own context, the one Read and Browse use. A node without
 * RolePermissions (and whose namespace declares no default) grants everything, as before.
 */
export function canReceiveEvent(context: ISessionContext, addressSpace: IAddressSpace, eventData: IEventData): boolean {
    const eventTypeNode = eventData.getEventDataSource();
    if (!context.checkPermission(eventTypeNode, PermissionType.ReceiveEvents)) {
        return false;
    }
    const sourceNodeId = (eventData as IEventDataWithSourceNode).sourceNode?.value as NodeId | undefined;
    const sourceNode = sourceNodeId ? addressSpace.findNode(sourceNodeId) : null;
    if (sourceNode && !context.checkPermission(sourceNode, PermissionType.ReceiveEvents)) {
        return false;
    }
    return true;
}
