import type { UAMethod } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

import type { UAAutoIdDevice, UAAutoIdDevice_Base, UAAutoIdDevice_runtimeParameters } from "./ua_auto_id_device";

// ----- this file has been automatically generated - do not edit

export interface UAOpticalReaderDevice_runtimeParameters extends UAAutoIdDevice_runtimeParameters { // Object
      /**
       * matchCode
       * Target value for 2D or OCR decoding.
       */
      matchCode?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * templateName
       * Activate template which defines a specific
       * identification task.
       */
      templateName?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OpticalReaderDeviceType i=1008                              |
 * |isAbstract      |false                                                       |
 */
export interface UAOpticalReaderDevice_Base extends UAAutoIdDevice_Base {
    images?: UAFolder;
    runtimeParameters?: UAOpticalReaderDevice_runtimeParameters;
    scan?: UAMethod;
}
export interface UAOpticalReaderDevice extends Omit<UAAutoIdDevice, "runtimeParameters"|"scan">, UAOpticalReaderDevice_Base {}