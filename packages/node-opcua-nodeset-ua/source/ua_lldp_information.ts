import type { UAObject } from "node-opcua-address-space-base";

import type { UAFolder } from "./ua_folder";
import type { UALldpLocalSystem } from "./ua_lldp_local_system";
import type { UALldpRemoteStatistics } from "./ua_lldp_remote_statistics";

// ----- this file has been automatically generated - do not edit

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
export interface UALldpInformation extends UAObject, UALldpInformation_Base {}