// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ExtensionFieldsType ns=0;i=15489                  |
 * |isAbstract      |false                                             |
 */
export interface UAExtensionFields_Base {
   // PlaceHolder for $ExtensionFieldName$
    addExtensionField: UAMethod;
    removeExtensionField: UAMethod;
}
export interface UAExtensionFields extends UAObject, UAExtensionFields_Base {
}