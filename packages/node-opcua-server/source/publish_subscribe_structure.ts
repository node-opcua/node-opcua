/**
 * @module node-opcua-server
 */
import { ensureStructureIsBrowsable, type IAddressSpace } from "node-opcua-address-space";
import { ObjectIds } from "node-opcua-constants";

/**
 * keep the structure of Server/PublishSubscribe visible to every session.
 *
 * `Opc.Ua.NodeSet2.xml` reserves Browse of eleven nodes under it - the methods of
 * SecurityGroups and KeyPushTargets, with their arguments - to the SecurityKeyServerAdmin
 * role, and the loader applies the nodeset's RolePermissions. No user manager of node-opcua
 * assigns that role, so no session could see them, and SecurityGroups, browsable by everyone,
 * showed an instance without the mandatory methods of SecurityGroupFolderType (CTT Base Info
 * Core Structure 002, FEAT-30). Browse is granted to every session; Call stays with the role
 * the nodeset named, as does every other permission.
 */
export function ensurePublishSubscribeIsBrowsable(addressSpace: IAddressSpace): void {
    const publishSubscribe = addressSpace.findNode(ObjectIds.PublishSubscribe);
    if (!publishSubscribe) {
        return;
    }
    ensureStructureIsBrowsable(publishSubscribe);
}
