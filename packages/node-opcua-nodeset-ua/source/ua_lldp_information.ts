// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UALldpRemoteStatistics } from "./ua_lldp_remote_statistics"
import { UALldpLocalSystem } from "./ua_lldp_local_system"
import { UAFolder } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LldpInformationType i=18973                                 |
 * |isAbstract      |false                                                       |
 */
export interface UALldpInformation_Base {
    remoteStatistics?: UALldpRemoteStatistics;
    localSystemData: UALldpLocalSystem;
    ports: UAFolder;
}
export interface UALldpInformation extends UAObject, UALldpInformation_Base {
}