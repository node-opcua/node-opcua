import { IAddressSpace, UAVariable } from "node-opcua-address-space-base";

export function adjustNamespaceArray(addressSpace: IAddressSpace): void {
    const namepsaceArrayVar = addressSpace.findNode("Server_NamespaceArray") as UAVariable;
    if (namepsaceArrayVar) {
        namepsaceArrayVar.setValueFromSource({
            dataType: "String",
            value: addressSpace.getNamespaceArray().map((n) => n.namespaceUri)
        });
    }
}
