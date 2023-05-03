// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { EnumId } from "./enum_id"
import { UAAddressSpaceFile } from "./ua_address_space_file"
import { DTRolePermission } from "./dt_role_permission"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NamespaceMetadataType i=11616                               |
 * |isAbstract      |false                                                       |
 */
export interface UANamespaceMetadata_Base {
    "$namespaceUri": UAProperty<UAString, DataType.String>;
    namespaceVersion: UAProperty<UAString, DataType.String>;
    namespacePublicationDate: UAProperty<Date, DataType.DateTime>;
    isNamespaceSubset: UAProperty<boolean, DataType.Boolean>;
    staticNodeIdTypes: UAProperty<EnumId[], DataType.Int32>;
    staticNumericNodeIdRange: UAProperty<UAString[], DataType.String>;
    staticStringNodeIdPattern: UAProperty<UAString, DataType.String>;
    namespaceFile?: UAAddressSpaceFile;
    defaultRolePermissions?: UAProperty<DTRolePermission[], DataType.ExtensionObject>;
    defaultUserRolePermissions?: UAProperty<DTRolePermission[], DataType.ExtensionObject>;
    defaultAccessRestrictions?: UAProperty<UInt16, DataType.UInt16>;
    configurationVersion?: UAProperty<UInt32, DataType.UInt32>;
}
export interface UANamespaceMetadata extends UAObject, UANamespaceMetadata_Base {
}