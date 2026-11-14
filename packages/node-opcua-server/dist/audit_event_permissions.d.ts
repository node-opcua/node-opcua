/**
 * @module node-opcua-server
 */
import { type IAddressSpace, type IEventData, type ISessionContext, type RoleIdLike } from "node-opcua-address-space";
/**
 * The Roles that receive Audit Events when OPCUAServerOptions.auditEventRoles is not given.
 *
 * OPC 10000-2 v1.05.06 §4.14: "the ability to subscribe for Audit Events is restricted to appropriate users
 * and/or applications". OPC 10000-3 v1.05.06 §4.9.2 describes SecurityAdmin as the Role "allowed to change
 * security related settings", the one an audit trail of sessions, certificates and identities
 * belongs to.
 */
export declare const defaultAuditEventRoles: RoleIdLike[];
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
export declare function restrictAuditEventReception(addressSpace: IAddressSpace, roles: RoleIdLike[]): number;
/**
 * OPC 10000-3 PermissionType: "ReceiveEvents, bit 11: A Client only receives an Event if this bit is
 * set on the Node identified by the EventTypeId field and on the Node identified by the SourceNode
 * field."
 *
 * Evaluated with the Session's own context, the one Read and Browse use. A node without
 * RolePermissions (and whose namespace declares no default) grants everything, as before.
 */
export declare function canReceiveEvent(context: ISessionContext, addressSpace: IAddressSpace, eventData: IEventData): boolean;
//# sourceMappingURL=audit_event_permissions.d.ts.map