import type { UAMethod } from "node-opcua-address-space-base";

import type { UAFolder, UAFolder_Base } from "./ua_folder";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FileDirectoryType i=13353                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAFileDirectory_Base extends UAFolder_Base {
    createDirectory: UAMethod;
    createFile: UAMethod;
    delete: UAMethod;
    moveOrCopy: UAMethod;
   // PlaceHolder for $FileDirectoryName$
   // PlaceHolder for $FileName$
}
export interface UAFileDirectory extends UAFolder, UAFileDirectory_Base {}