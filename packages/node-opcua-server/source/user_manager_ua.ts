import { ensureObjectIsSecure, type IAddressSpace, type UAObject, type UARole, type UARoleSet } from "node-opcua-address-space";
import { ObjectIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { DataType, Variant } from "node-opcua-variant";
import type { UAUserManagerBase } from "./user_manager";

export function bindRoleSet(userManager: UAUserManagerBase, addressSpace: IAddressSpace) {
    const roleSet = addressSpace.findNode(ObjectIds.Server_ServerCapabilities_RoleSet) as UARoleSet;
    if (!roleSet) return;

    const components = roleSet.getComponents();
    for (const component of components) {
        ensureObjectIsSecure(component);
        if (component.nodeClass !== NodeClass.Object) {
            continue;
        }
        const o = component as UAObject;
        if (o.typeDefinitionObj.browseName.name !== "RoleType") {
            continue;
        }
        const roleType = o as UARole;
        const roleTypeProperties = roleType.findReferencesAsObject("HasChild", false);
        for (const roleTypeProp of roleTypeProperties) {
            ensureObjectIsSecure(roleTypeProp);
        }
        roleType.identities.setValueFromSource({ dataType: DataType.ExtensionObject, value: [] });

        roleType.endpoints?.setValueFromSource({ dataType: DataType.ExtensionObject, value: [] });
        roleType.identities.bindVariable(
            {
                get: () => {
                    const identities = userManager.getIdentitiesForRole(roleType.nodeId);

                    return new Variant({ dataType: DataType.ExtensionObject, value: identities });
                }
            },
            true
        );
    }

    userManager.bind(roleSet);
}
