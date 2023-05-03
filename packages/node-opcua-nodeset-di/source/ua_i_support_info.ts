// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
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
export interface UAISupportInfo extends UABaseInterface, UAISupportInfo_Base {
}