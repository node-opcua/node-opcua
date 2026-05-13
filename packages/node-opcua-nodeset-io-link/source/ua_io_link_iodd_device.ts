import type { UAProperty } from "node-opcua-address-space-base";
import type { Byte, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { UAOptionSet } from "node-opcua-nodeset-ua/dist/ua_option_set";
import type { DataType } from "node-opcua-variant";

import type { UADeviceVariant } from "./ua_device_variant";
import type { UAIOLinkDevice, UAIOLinkDevice_Base, UAIOLinkDevice_parameterSet } from "./ua_io_link_device";

// ----- this file has been automatically generated - do not edit

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
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IOLink/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOLinkIODDDeviceType i=1012                                 |
 * |isAbstract      |true                                                        |
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
export interface UAIOLinkIODDDevice extends Omit<UAIOLinkDevice, "parameterSet">, UAIOLinkIODDDevice_Base {}