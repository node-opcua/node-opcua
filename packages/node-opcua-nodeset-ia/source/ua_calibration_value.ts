import type { UAProperty } from "node-opcua-address-space-base";
import type { EUInformation } from "node-opcua-data-access";
import type { UADataItem, UADataItem_Base } from "node-opcua-nodeset-ua/dist/ua_data_item";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * Represents the specific quantity and value (with
 * engineering unit) that a calibration target
 * provides for calibration of equipment.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |CalibrationValueType i=2002                                 |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UACalibrationValue_Base<T, DT extends DataType>  extends UADataItem_Base<T, DT> {
    engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
}
export interface UACalibrationValue<T, DT extends DataType> extends UADataItem<T, DT>, UACalibrationValue_Base<T, DT> {}