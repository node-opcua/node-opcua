// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalyticalMeasurementVariable, UAAnalyticalMeasurementVariable_Base } from "./ua_analytical_measurement_variable"
import { DTChemicalSubstance } from "./dt_chemical_substance"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |PatMeasurementVariableType i=1274                           |
 * |dataType        |Float                                                       |
 * |dataType Name   |number i=10                                                 |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAPatMeasurementVariable_Base<T extends number>  extends UAAnalyticalMeasurementVariable_Base<T> {
    patMatrixDescription?: UAProperty<DTChemicalSubstance[], DataType.ExtensionObject>;
    patMeasurandDescription?: UAProperty<DTChemicalSubstance, DataType.ExtensionObject>;
}
export interface UAPatMeasurementVariable<T extends number> extends UAAnalyticalMeasurementVariable<T>, UAPatMeasurementVariable_Base<T> {
}