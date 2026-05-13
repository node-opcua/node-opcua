import type { UAObject } from "node-opcua-address-space-base";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurableObjectType i=1004                               |
 * |isAbstract      |false                                                       |
 */
export interface UAConfigurableObject_Base {
    supportedTypes: UAFolder;
   // PlaceHolder for $ObjectIdentifier$
}
export interface UAConfigurableObject extends UAObject, UAConfigurableObject_Base {}