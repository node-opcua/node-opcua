import { AddressSpace } from "../../source/address_space_ts";
import { UAVariable } from "../ua_variable";


export function adjustNamespaceArray(addressSpace: AddressSpace) {
    const namepsaceArrayVar = addressSpace.findNode("Server_NamespaceArray") as UAVariable;
    if (namepsaceArrayVar) {
        namepsaceArrayVar.setValueFromSource({
            dataType: "String",
            value: addressSpace.getNamespaceArray().map((n) => n.namespaceUri)
        });
    }
}

