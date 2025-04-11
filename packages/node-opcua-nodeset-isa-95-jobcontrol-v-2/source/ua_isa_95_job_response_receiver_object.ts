// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"

/**
 * A Job Response Receiver receives unsolicited Job
 * Responses, usually as the result of completion of
 * a job, or at intermediate points within the job.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95JobResponseReceiverObjectType i=1004                   |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95JobResponseReceiverObject_Base {
    receiveJobResponse: UAMethod;
}
export interface UAISA95JobResponseReceiverObject extends UAObject, UAISA95JobResponseReceiverObject_Base {
}