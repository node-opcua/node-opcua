import { Namespace, UAVariable } from "node-opcua-address-space";
import { displayNodeElement } from "./displayNodeElement";
import { UANamespaceMetadataType } from "./types";
import { DataType } from "node-opcua-variant";

function specialEncode(namespaceUri: string): string {
    return namespaceUri;
}

export function setNamespaceMetaData(namespace: Namespace) {
    // NamespaceMetadataType
    const addressSpace = namespace.addressSpace;
    const namespaceMetadataType = addressSpace.findObjectType("NamespaceMetadataType");
    const namespaces = addressSpace.rootFolder.objects.server.getChildByName("Namespaces");

    /* istanbul ignore next */
    if (!namespaces) {
        displayNodeElement(addressSpace.rootFolder.objects.server);
        throw new Error("Cannot find namespacesType node under server object");
        // ignoring namespace time
        return;
    }
    /* istanbul ignore next */
    if (!namespaceMetadataType) {
        throw new Error("cannot find NamespaceMetadataType");
    }

    const deriveName = specialEncode(namespace.namespaceUri);

    const metaData = (namespaceMetadataType.instantiate({
        browseName: deriveName,
        componentOf: namespaces
    }) as any) as UANamespaceMetadataType;

    // FIX ME namespaceUri collides with UAObject.namespaceUri  !!!!
    const namespaceUri = metaData.getChildByName("NamespaceUri") as UAVariable;
    namespaceUri.setValueFromSource({ dataType: DataType.String, value: namespace.namespaceUri });

    const namespacePublicationDate = metaData.namespacePublicationDate;
    namespacePublicationDate.setValueFromSource({ dataType: DataType.DateTime, value: new Date() });

    const namespaceVersion = metaData.namespaceVersion;
    namespaceVersion.setValueFromSource({ dataType: DataType.String, value: "1.0.0" });
}
