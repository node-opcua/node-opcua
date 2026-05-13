import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PrognosisType i=3                                           |
 * |isAbstract      |true                                                        |
 */
export interface UAPrognosis_Base {
    predictedTime: UAProperty<Date, DataType.DateTime>;
}
export interface UAPrognosis extends UAObject, UAPrognosis_Base {}