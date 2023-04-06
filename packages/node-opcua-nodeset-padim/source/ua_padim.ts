// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { EnumDeviceHealth } from "node-opcua-nodeset-di/source/enum_device_health"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
import { UAConfigurableObject } from "node-opcua-nodeset-di/source/ua_configurable_object"
import { UASignalSet } from "./ua_signal_set"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:PADIMType ns=20;i=1009                         |
 * |isAbstract      |false                                             |
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
}
export interface UAPADIM extends Omit<UAComponent, "manufacturer"|"manufacturerUri"|"model"|"serialNumber"|"softwareRevision"|"hardwareRevision"|"productCode"|"productInstanceUri"|"assetId"|"revisionCounter">, UAPADIM_Base {
}