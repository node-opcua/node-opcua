// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAMeasuredItem, UAMeasuredItem_Base } from "./ua_measured_item"
import { DTWeight } from "./dt_weight"
import { DTPrintableWeight } from "./dt_printable_weight"
import { EnumTareMode } from "./enum_tare_mode"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |WeightItemType i=53                                         |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTWeight i=55                                               |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAWeightItem_Base<T extends DTWeight>  extends UAMeasuredItem_Base<T, DataType.ExtensionObject> {
    centerOfZero?: UAProperty<boolean, DataType.Boolean>;
    currentRangeId?: UAProperty<UInt16, DataType.UInt16>;
    gross?: UAProperty<number, DataType.Double>;
    grossNegative?: UAProperty<boolean, DataType.Boolean>;
    highResolutionValue?: UAProperty<DTWeight, DataType.ExtensionObject>;
    /**
     * insideZero
     * Defines if the current measured value is within
     * the valid range for the setting zero procedure.
     * This is a necessary condition to success the
     * setZero() method if available.
     */
    insideZero?: UAProperty<boolean, DataType.Boolean>;
    legalForTrade?: UAProperty<boolean, DataType.Boolean>;
    net?: UAProperty<number, DataType.Double>;
    overload: UAProperty<boolean, DataType.Boolean>;
    printableValue?: UAProperty<DTPrintableWeight, DataType.ExtensionObject>;
    tare?: UAProperty<number, DataType.Double>;
    tareMode: UAProperty<EnumTareMode, DataType.Int32>;
    underload: UAProperty<boolean, DataType.Boolean>;
    weightId?: UAProperty<UAString, DataType.String>;
    weightStable?: UAProperty<boolean, DataType.Boolean>;
}
export interface UAWeightItem<T extends DTWeight> extends UAMeasuredItem<T, DataType.ExtensionObject>, UAWeightItem_Base<T> {
}