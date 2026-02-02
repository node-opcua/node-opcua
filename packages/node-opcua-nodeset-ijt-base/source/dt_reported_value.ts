// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This structure provides the given value and
 * corresponding limits for a given physical
 * quantity (if applicable).
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |ReportedValueDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTReportedValue extends DTStructure {
  /** It is the physical quantity of the value. Example: Torque, Angle, etc. 
Note: It may not be applicable for few reported values such as Software Version, etc.*/
  physicalQuantity?: Byte; // Byte ns=0;i=3
  /** It is the name of the given value.*/
  name?: UAString; // String ns=0;i=12
  /** It is the current value. The data type can be any simple data type such as Integer, String, Double, DateTime, etc. If the value is corresponding to the physical quantity, then the recommended data type is Double.*/
  currentValue: VariantOptions; // Variant ns=0;i=0
  /** It is the previous value (if available). The data type can be any simple data type such as Integer, String, Double, DateTime, etc. If the value is corresponding to the physical quantity, then the data type should be Double.*/
  previousValue?: VariantOptions; // Variant ns=0;i=0
  /** It is the low limit of the given value. It is not applicable for values which do not have PhysicalQuantity.*/
  lowLimit?: number; // Double ns=0;i=11
  /** It is the high limit of the given value. It is not applicable for values which do not have PhysicalQuantity.*/
  highLimit?: number; // Double ns=0;i=11
  /** It is the engineering unit of the CurrentValue, PreviousValue, LowLimit, HighLimit.
It is not applicable for values which does not have PhysicalQuantity.*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
}
export interface UDTReportedValue extends ExtensionObject, DTReportedValue {};