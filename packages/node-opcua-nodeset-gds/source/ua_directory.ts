import type { UAMethod } from "node-opcua-address-space-base";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DirectoryType i=13                                          |
 * |isAbstract      |false                                                       |
 */
export interface UADirectory_Base extends UAFolder_Base {
    applications: UAFolder;
    findApplications: UAMethod;
    registerApplication: UAMethod;
    updateApplication: UAMethod;
    unregisterApplication: UAMethod;
    getApplication: UAMethod;
    queryApplications: UAMethod;
    queryServers: UAMethod;
}
export interface UADirectory extends UAFolder, UADirectory_Base {}