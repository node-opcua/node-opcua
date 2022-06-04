// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Guid } from "node-opcua-basic-types"
import { DTConfigurationVersion } from "./dt_configuration_version"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { UAExtensionFields } from "./ua_extension_fields"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PublishedDataSetType ns=0;i=14509                 |
 * |isAbstract      |false                                             |
 */
export interface UAPublishedDataSet_Base {
    configurationVersion: UAProperty<DTConfigurationVersion, /*z*/DataType.ExtensionObject>;
    dataSetMetaData: UAProperty<DTDataSetMeta, /*z*/DataType.ExtensionObject>;
    dataSetClassId?: UAProperty<Guid, /*z*/DataType.Guid>;
    cyclicDataSet?: UAProperty<boolean, /*z*/DataType.Boolean>;
    extensionFields?: UAExtensionFields;
}
export interface UAPublishedDataSet extends UAObject, UAPublishedDataSet_Base {
}