// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:PrognosisListType ns=10;i=2                    |
 * |isAbstract      |false                                             |
 */
export interface UAPrognosisList_Base {
    nodeVersion?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAPrognosisList extends UAObject, UAPrognosisList_Base {
}