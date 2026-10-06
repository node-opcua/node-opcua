import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder.js";

import type { UASubscriberCapabilities } from "./ua_subscriber_capabilities.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InputsFolderType i=1000                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAInputsFolder_Base extends UAFolder_Base {
   // PlaceHolder for $InputVariable1$
    subscriberCapabilities?: UASubscriberCapabilities;
   // PlaceHolder for $InputGroup$
   // PlaceHolder for $InputVariable$
}
export interface UAInputsFolder extends UAFolder, UAInputsFolder_Base {}