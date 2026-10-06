import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder.js";

import type { UAPublisherCapabilities } from "./ua_publisher_capabilities.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |OutputsFolderType i=1019                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAOutputsFolder_Base extends UAFolder_Base {
   // PlaceHolder for $OutputVariable1$
    publisherCapabilities?: UAPublisherCapabilities;
   // PlaceHolder for $OutputGroup$
   // PlaceHolder for $OutputVariable$
}
export interface UAOutputsFolder extends UAFolder, UAOutputsFolder_Base {}