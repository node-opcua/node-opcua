import { INamespace, UAObject, UAVariable } from "node-opcua-address-space-base";
import { UANamespaceMetadata } from "node-opcua-nodeset-ua";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

function specialEncode(namespaceUri: string): string {
    return namespaceUri;
}

export function setNamespaceMetaData(namespace: INamespace): void {
    // NamespaceMetadataType
    const addressSpace = namespace.addressSpace;
    const namespaceMetadataType = addressSpace.findObjectType("NamespaceMetadataType");
    const namespaces = addressSpace.rootFolder.objects.server.getChildByName("Namespaces") as UAObject;

    /* istanbul ignore next */
    if (!namespaces) {
        throw new Error("Cannot find namespacesType node under server object");
    }
    /* istanbul ignore next */
    if (!namespaceMetadataType) {
        throw new Error("cannot find NamespaceMetadataType");
    }

    const deriveName = specialEncode(namespace.namespaceUri);

    const existingMetaData = namespaces.getComponentByName(deriveName, namespace.index);

    /* istanbul ignore next */
    if (existingMetaData) {
        throw new Error("INamespace meta data already exists for " + deriveName);
    }
    const metaData = namespaceMetadataType.instantiate({
        browseName: deriveName,
        componentOf: namespaces,
        optionals: [
            "DefaultRolePermissions",
            "DefaultAccessRestrictions",
            "DefaultUserRolePermissions"
            // "NamespaceFile"
        ]
    }) as UANamespaceMetadata;

    // FIX ME namespaceUri collides with UAObject.namespaceUri  !!!!
    const namespaceUri = metaData.getChildByName("NamespaceUri") as UAVariable;
    namespaceUri.setValueFromSource({ dataType: DataType.String, value: namespace.namespaceUri });

    const namespacePublicationDate = metaData.namespacePublicationDate;
    namespacePublicationDate.setValueFromSource({ dataType: DataType.DateTime, value: new Date() });

    const namespaceVersion = metaData.namespaceVersion;
    namespaceVersion.setValueFromSource({ dataType: DataType.String, value: "1.0.0" });

    metaData.defaultAccessRestrictions?.bindVariable(
        {
            get: () =>
                new Variant({
                    dataType: DataType.UInt16,
                    value: namespace.getDefaultAccessRestrictions()
                })
        },
        true
    );
    metaData.defaultRolePermissions?.bindVariable(
        {
            get: () =>
                new Variant({
                    dataType: DataType.ExtensionObject,
                    arrayType: VariantArrayType.Array,
                    value: namespace.getDefaultRolePermissions()
                })
        },
        true
    );
}
