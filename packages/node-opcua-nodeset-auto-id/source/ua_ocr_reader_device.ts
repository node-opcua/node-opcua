// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAAutoIdDevice_runtimeParameters, UAAutoIdDevice, UAAutoIdDevice_Base } from "./ua_auto_id_device"
export interface UAOcrReaderDevice_runtimeParameters extends UAAutoIdDevice_runtimeParameters { // Object
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
 * |typedDefinition |OcrReaderDeviceType i=1002                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAOcrReaderDevice_Base extends UAAutoIdDevice_Base {
    images?: UAFolder;
    runtimeParameters?: UAOcrReaderDevice_runtimeParameters;
    scan?: UAMethod;
}
export interface UAOcrReaderDevice extends Omit<UAAutoIdDevice, "runtimeParameters"|"scan">, UAOcrReaderDevice_Base {
}