import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PrognosisListType i=2                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAPrognosisList_Base {
   // PlaceHolder for $Prognosis$
    nodeVersion?: UAProperty<UAString, DataType.String>;
}
export interface UAPrognosisList extends UAObject, UAPrognosisList_Base {}