import { ensureObjectIsSecure } from "node-opcua-address-space";
import { ObjectIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { DataType, Variant } from "node-opcua-variant";
export function bindRoleSet(userManager, addressSpace) {
    const roleSet = addressSpace.findNode(ObjectIds.Server_ServerCapabilities_RoleSet);
    if (!roleSet)
        return;
    const components = roleSet.getComponents();
    for (const component of components) {
        ensureObjectIsSecure(component);
        if (component.nodeClass !== NodeClass.Object) {
            continue;
        }
        const o = component;
        if (o.typeDefinitionObj.browseName.name !== "RoleType") {
            continue;
        }
        const roleType = o;
        const roleTypeProperties = roleType.findReferencesAsObject("HasChild", false);
        for (const roleTypeProp of roleTypeProperties) {
            ensureObjectIsSecure(roleTypeProp);
        }
        roleType.identities.setValueFromSource({ dataType: DataType.ExtensionObject, value: [] });
        roleType.endpoints?.setValueFromSource({ dataType: DataType.ExtensionObject, value: [] });
        roleType.identities.bindVariable({
            get: () => {
                const identities = userManager.getIdentitiesForRole(roleType.nodeId);
                return new Variant({ dataType: DataType.ExtensionObject, value: identities });
            }
        }, true);
    }
    userManager.bind(roleSet);
}
//# sourceMappingURL=user_manager_ua.js.map