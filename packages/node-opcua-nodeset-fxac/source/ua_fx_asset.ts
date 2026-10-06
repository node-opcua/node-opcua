import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health.js";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UASoftwareUpdate } from "node-opcua-nodeset-di/dist/ua_software_update.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UAFxAsset_diagnostics extends UAFunctionalGroup { // Object
      currentCPUUtilization?: UABaseDataVariable<number, DataType.Float>;
      currentMemoryUtilization?: UABaseDataVariable<number, DataType.Float>;
      maxCPUUtilization?: UABaseDataVariable<number, DataType.Float>;
      maxMemoryUtilization?: UABaseDataVariable<number, DataType.Float>;
      upTime?: UABaseDataVariable<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FxAssetType i=3                                             |
 * |isAbstract      |false                                                       |
 */
export interface UAFxAsset_Base {
    assetId?: UAProperty<UAString, DataType.String>;
    buildAssetNumber?: UAProperty<UInt16, DataType.UInt16>;
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    connectors?: UAFolder;
    deviceClass?: UAProperty<UAString, DataType.String>;
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    deviceHealthAlarms?: UAFolder;
    deviceManual?: UAProperty<UAString, DataType.String>;
    deviceRevision?: UAProperty<UAString, DataType.String>;
    diagnostics?: UAFxAsset_diagnostics;
    hardwareRevision?: UAProperty<UAString, DataType.String>;
    majorAssetVersion?: UAProperty<UInt16, DataType.UInt16>;
    manufacturer?: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    minorAssetVersion?: UAProperty<UInt16, DataType.UInt16>;
    model?: UAProperty<LocalizedText, DataType.LocalizedText>;
    productCode?: UAProperty<UAString, DataType.String>;
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    revisionCounter?: UAProperty<Int32, DataType.Int32>;
    serialNumber?: UAProperty<UAString, DataType.String>;
    softwareRevision?: UAProperty<UAString, DataType.String>;
    softwareUpdate?: UASoftwareUpdate;
    subBuildAssetNumber?: UAProperty<UInt16, DataType.UInt16>;
    verifyAsset?: UAMethod;
}
export interface UAFxAsset extends UAObject, UAFxAsset_Base {}