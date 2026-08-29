import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { Guid } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTConfigurationVersion } from "./dt_configuration_version.js";
import type { DTDataSetMeta } from "./dt_data_set_meta.js";
import type { UAExtensionFields } from "./ua_extension_fields.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PublishedDataSetType i=14509                                |
 * |isAbstract      |false                                                       |
 */
export interface UAPublishedDataSet_Base {
    configurationVersion: UAProperty<DTConfigurationVersion, DataType.ExtensionObject>;
    dataSetMetaData: UAProperty<DTDataSetMeta, DataType.ExtensionObject>;
    dataSetClassId?: UAProperty<Guid, DataType.Guid>;
    cyclicDataSet?: UAProperty<boolean, DataType.Boolean>;
    extensionFields?: UAExtensionFields;
}
export interface UAPublishedDataSet extends UAObject, UAPublishedDataSet_Base {}