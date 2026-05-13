import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { EnumDeviceHealth } from "./enum_device_health";
import type { UAComponent, UAComponent_Base } from "./ua_component";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DeviceType i=1002                                           |
 * |isAbstract      |true                                                        |
 */
export interface UADevice_Base extends UAComponent_Base {
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    hardwareRevision: UAProperty<UAString, DataType.String>;
    softwareRevision: UAProperty<UAString, DataType.String>;
    deviceRevision: UAProperty<UAString, DataType.String>;
    productCode?: UAProperty<UAString, DataType.String>;
    deviceManual: UAProperty<UAString, DataType.String>;
    deviceClass?: UAProperty<UAString, DataType.String>;
    serialNumber: UAProperty<UAString, DataType.String>;
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    revisionCounter: UAProperty<Int32, DataType.Int32>;
   // PlaceHolder for $cPIdentifier$
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    deviceHealthAlarms?: UAFolder;
    deviceTypeImage?: UAFolder;
    documentation?: UAFolder;
    protocolSupport?: UAFolder;
    imageSet?: UAFolder;
}
export interface UADevice extends Omit<UAComponent, "manufacturer"|"manufacturerUri"|"model"|"hardwareRevision"|"softwareRevision"|"deviceRevision"|"productCode"|"deviceManual"|"deviceClass"|"serialNumber"|"productInstanceUri"|"revisionCounter">, UADevice_Base {}