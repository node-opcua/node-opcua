// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UAMessages } from "./ua_messages"
import { UAPrognosisList } from "./ua_prognosis_list"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:NotificationType ns=10;i=7                     |
 * |isAbstract      |false                                             |
 */
export interface UANotification_Base {
    messages?: UAMessages;
    prognoses?: UAPrognosisList;
}
export interface UANotification extends UAObject, UANotification_Base {
}