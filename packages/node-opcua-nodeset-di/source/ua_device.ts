// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { EnumDeviceHealth } from "./enum_device_health"
import { UAComponent, UAComponent_Base } from "./ua_component"
/**
 * Defines the basic information components for all
 * configurable elements in a device topology
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:DeviceType ns=1;i=1002                          |
 * |isAbstract      |true                                              |
 */
export interface UADevice_Base extends UAComponent_Base {
    /**
     * manufacturer
     * Name of the company that manufactured the device
     */
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    /**
     * model
     * Model name of the device
     */
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * hardwareRevision
     * Revision level of the hardware of the device
     */
    hardwareRevision: UAProperty<UAString, DataType.String>;
    /**
     * softwareRevision
     * Revision level of the software/firmware of the
     * device
     */
    softwareRevision: UAProperty<UAString, DataType.String>;
    /**
     * deviceRevision
     * Overall revision level of the device
     */
    deviceRevision: UAProperty<UAString, DataType.String>;
    productCode?: UAProperty<UAString, DataType.String>;
    /**
     * deviceManual
     * Address (pathname in the file system or a URL |
     * Web address) of user manual for the device
     */
    deviceManual: UAProperty<UAString, DataType.String>;
    deviceClass?: UAProperty<UAString, DataType.String>;
    /**
     * serialNumber
     * Identifier that uniquely identifies, within a
     * manufacturer, a device instance
     */
    serialNumber: UAProperty<UAString, DataType.String>;
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    /**
     * revisionCounter
     * An incremental counter indicating the number of
     * times the static data within the Device has been
     * modified
     */
    revisionCounter: UAProperty<Int32, DataType.Int32>;
   // PlaceHolder for $cPIdentifier$
    deviceHealth?: UABaseDataVariable<EnumDeviceHealth, DataType.Int32>;
    deviceHealthAlarms?: UAFolder;
    /**
     * deviceTypeImage
     * Organizes pictures of the device.
     */
    deviceTypeImage?: UAFolder;
    /**
     * documentation
     * Organizes documents for the device.
     */
    documentation?: UAFolder;
    /**
     * protocolSupport
     * Protocol-specific files for the device.
     */
    protocolSupport?: UAFolder;
    /**
     * imageSet
     * Organizes images that are used within UIElements.
     */
    imageSet?: UAFolder;
}
export interface UADevice extends Omit<UAComponent, "manufacturer"|"manufacturerUri"|"model"|"hardwareRevision"|"softwareRevision"|"deviceRevision"|"productCode"|"deviceManual"|"deviceClass"|"serialNumber"|"productInstanceUri"|"revisionCounter">, UADevice_Base {
}