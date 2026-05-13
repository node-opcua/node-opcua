import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText, QualifiedName } from "node-opcua-data-model";
import type { EnumDeviceHealth } from "node-opcua-nodeset-di/dist/enum_device_health";
import type { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component";
import type { UAConfigurableObject } from "node-opcua-nodeset-di/dist/ua_configurable_object";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { UAGeneralDeviceConditionSet } from "./ua_general_device_condition_set";
import type { UASignalSet } from "./ua_signal_set";

// ----- this file has been automatically generated - do not edit

export interface UAPADIM_deviceConditionSet extends UAObject { // Object
      deviceComponentConditions?: UAObject;
      generalDeviceConditions?: UAGeneralDeviceConditionSet;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PADIMType i=1009                                            |
 * |isAbstract      |false                                                       |
 */
export interface UAPADIM_Base extends UAComponent_Base {
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri: UAProperty<UAString, DataType.String>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    serialNumber: UAProperty<UAString, DataType.String>;
    softwareRevision: UAProperty<UAString, DataType.String>;
    hardwareRevision: UAProperty<UAString, DataType.String>;
    productCode: UAProperty<UAString, DataType.String>;
    deviceHealth: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    dateOfLastChange?: UABaseDataVariable<Date, DataType.DateTime>;
    displayLanguage?: UABaseDataVariable<UAString, DataType.String>;
    signalSet?: UASignalSet;
    productInstanceUri: UAProperty<UAString, DataType.String>;
    deviceHealthAlarms?: UAFolder;
    subDevices?: UAConfigurableObject;
    factoryReset?: UAMethod;
    assetId: UAProperty<UAString, DataType.String>;
    revisionCounter: UAProperty<Int32, DataType.Int32>;
    deviceRevision?: UAProperty<UAString, DataType.String>;
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    deviceConditionSet?: UAPADIM_deviceConditionSet;
}
export interface UAPADIM extends Omit<UAComponent, "manufacturer"|"manufacturerUri"|"model"|"serialNumber"|"softwareRevision"|"hardwareRevision"|"productCode"|"productInstanceUri"|"assetId"|"revisionCounter"|"deviceRevision">, UAPADIM_Base {}