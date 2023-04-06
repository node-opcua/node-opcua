// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, Byte, UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAOptionSet } from "node-opcua-nodeset-ua/source/ua_option_set"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UAIOLinkDevice_parameterSet, UAIOLinkDevice, UAIOLinkDevice_Base } from "./ua_io_link_device"
import { UADeviceVariant } from "./ua_device_variant"
export interface UAIOLinkIODDDevice_deviceTypeImage extends UAFolder { // Object
   // PlaceHolder for $ImageIdentifier$
      deviceIcon?: UABaseDataVariable<Buffer, DataType.ByteString>;
      deviceSymbol?: UABaseDataVariable<Buffer, DataType.ByteString>;
}
export interface UAIOLinkIODDDevice_ioDDInformation extends UAFolder { // Object
      copyright: UAProperty<UAString, DataType.String>;
      ioLinkRevision: UAProperty<UAString, DataType.String>;
      releaseDate: UAProperty<UAString, DataType.String>;
      version: UAProperty<UAString, DataType.String>;
}
export interface UAIOLinkIODDDevice_parameterSet extends UAIOLinkDevice_parameterSet { // Object
      supportedAccessLocks?: UAOptionSet<Byte, DataType.Byte>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |17:IOLinkIODDDeviceType ns=17;i=1012              |
 * |isAbstract      |true                                              |
 */
export interface UAIOLinkIODDDevice_Base extends UAIOLinkDevice_Base {
    deviceName: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * deviceTypeImage
     * Organizes pictures of the device.
     */
    deviceTypeImage?: UAIOLinkIODDDevice_deviceTypeImage;
    deviceVariant: UADeviceVariant;
    deviceVariants: UAFolder;
    ioDDInformation: UAIOLinkIODDDevice_ioDDInformation;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAIOLinkIODDDevice_parameterSet;
    vendorLogo?: UAProperty<Buffer, DataType.ByteString>;
    vendorURL: UAProperty<UAString, DataType.String>;
    maintenance: UAFunctionalGroup;
    observer: UAFunctionalGroup;
    specialist: UAFunctionalGroup;
}
export interface UAIOLinkIODDDevice extends Omit<UAIOLinkDevice, "parameterSet">, UAIOLinkIODDDevice_Base {
}