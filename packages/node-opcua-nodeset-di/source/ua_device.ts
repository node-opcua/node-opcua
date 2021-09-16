// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
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
    manufacturer: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * model
     * Model name of the device
     */
    model: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    /**
     * hardwareRevision
     * Revision level of the hardware of the device
     */
    hardwareRevision: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * softwareRevision
     * Revision level of the software/firmware of the
     * device
     */
    softwareRevision: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * deviceRevision
     * Overall revision level of the device
     */
    deviceRevision: UAProperty<UAString, /*z*/DataType.String>;
    productCode?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * deviceManual
     * Address (pathname in the file system or a URL |
     * Web address) of user manual for the device
     */
    deviceManual: UAProperty<UAString, /*z*/DataType.String>;
    deviceClass?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * serialNumber
     * Identifier that uniquely identifies, within a
     * manufacturer, a device instance
     */
    serialNumber: UAProperty<UAString, /*z*/DataType.String>;
    productInstanceUri?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * revisionCounter
     * An incremental counter indicating the number of
     * times the static data within the Device has been
     * modified
     */
    revisionCounter: UAProperty<Int32, /*z*/DataType.Int32>;
    deviceHealth?: UABaseDataVariable<any, any>;
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