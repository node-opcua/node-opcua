// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { EnumId } from "./enum_id"
import { UAAddressSpaceFile } from "./ua_address_space_file"
import { DTRolePermission } from "./dt_role_permission"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NamespaceMetadataType ns=0;i=11616                |
 * |isAbstract      |false                                             |
 */
export interface UANamespaceMetadata_Base {
    "$namespaceUri": UAProperty<UAString, /*z*/DataType.String>;
    namespaceVersion: UAProperty<UAString, /*z*/DataType.String>;
    namespacePublicationDate: UAProperty<Date, /*z*/DataType.DateTime>;
    isNamespaceSubset: UAProperty<boolean, /*z*/DataType.Boolean>;
    staticNodeIdTypes: UAProperty<EnumId[], /*z*/DataType.Int32>;
    staticNumericNodeIdRange: UAProperty<UAString[], /*z*/DataType.String>;
    staticStringNodeIdPattern: UAProperty<UAString, /*z*/DataType.String>;
    namespaceFile?: UAAddressSpaceFile;
    defaultRolePermissions?: UAProperty<DTRolePermission[], /*z*/DataType.ExtensionObject>;
    defaultUserRolePermissions?: UAProperty<DTRolePermission[], /*z*/DataType.ExtensionObject>;
    defaultAccessRestrictions?: UAProperty<UInt16, /*z*/DataType.UInt16>;
    configurationVersion?: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UANamespaceMetadata extends UAObject, UANamespaceMetadata_Base {
}