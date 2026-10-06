import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

import type { UAControlItemFolder } from "./ua_control_item_folder.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControlGroupType i=15                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAControlGroup_Base {
    establishControl?: UAMethod;
    isControlled: UAProperty<boolean, DataType.Boolean>;
    listOfRelated: UAFolder;
    listToBlock: UAControlItemFolder;
    listToRestrict: UAControlItemFolder;
    reassignControl?: UAMethod;
    releaseControl?: UAMethod;
   // PlaceHolder for $ControlGroup$
}
export interface UAControlGroup extends UAObject, UAControlGroup_Base {}