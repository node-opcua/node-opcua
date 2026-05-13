import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISupportInfoType i=15054                                    |
 * |isAbstract      |true                                                        |
 */
export interface UAISupportInfo_Base extends UABaseInterface_Base {
    deviceTypeImage?: UAFolder;
    documentation?: UAFolder;
    documentationFiles?: UAFolder;
    protocolSupport?: UAFolder;
    imageSet?: UAFolder;
}
export interface UAISupportInfo extends UABaseInterface, UAISupportInfo_Base {}