// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAUIElement } from "./ua_ui_element"
/**
 * FolderType is used to organize the Parameters and
 * Methods from the complete set (ParameterSet,
 * MethodSet) with regard to their application
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:FunctionalGroupType ns=1;i=1005                 |
 * |isAbstract      |false                                             |
 */
export interface UAFunctionalGroup_Base extends UAFolder_Base {
   // PlaceHolder for $GroupIdentifier$
    /**
     * uiElement
     * A user interface element assigned to this group.
     */
    uiElement?: UAUIElement<any, any>;
}
export interface UAFunctionalGroup extends UAFolder, UAFunctionalGroup_Base {
}