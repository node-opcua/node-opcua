// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UADataItem, UADataItem_Base } from "node-opcua-nodeset-ua/source/ua_data_item"
/**
 * Represents the specific quantity and value (with
 * engineering unit) that a calibration target
 * provides for calibration of equipment.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |9:CalibrationValueType ns=9;i=2002                |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UACalibrationValue_Base<T, DT extends DataType>  extends UADataItem_Base<T/*g*/, DT> {
    engineeringUnits: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UACalibrationValue<T, DT extends DataType> extends UADataItem<T, /*m*/DT>, UACalibrationValue_Base<T, DT /*A*/> {
}