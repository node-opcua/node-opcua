import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder";

import type { UAUIElement } from "./ua_ui_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionalGroupType i=1005                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAFunctionalGroup_Base extends UAFolder_Base {
   // PlaceHolder for $GroupIdentifier$
    uiElement?: UAUIElement<any, any>;
}
export interface UAFunctionalGroup extends UAFolder, UAFunctionalGroup_Base {}