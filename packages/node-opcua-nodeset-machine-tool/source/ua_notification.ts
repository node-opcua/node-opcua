import type { UAObject } from "node-opcua-address-space-base";

import type { UAMessages } from "./ua_messages";
import type { UAPrognosisList } from "./ua_prognosis_list";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NotificationType i=7                                        |
 * |isAbstract      |false                                                       |
 */
export interface UANotification_Base {
    messages?: UAMessages;
    prognoses?: UAPrognosisList;
}
export interface UANotification extends UAObject, UANotification_Base {}