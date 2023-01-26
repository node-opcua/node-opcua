// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
/**
 * Defines a general pattern to expose and configure
 * modular components
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:ConfigurableObjectType ns=1;i=1004              |
 * |isAbstract      |false                                             |
 */
export interface UAConfigurableObject_Base {
    /**
     * supportedTypes
     * Folder maintaining the set of (sub-types of)
     * BaseObjectTypes that can be instantiated in the
     * ConfigurableComponent
     */
    supportedTypes: UAFolder;
   // PlaceHolder for $ObjectIdentifier$
}
export interface UAConfigurableObject extends UAObject, UAConfigurableObject_Base {
}