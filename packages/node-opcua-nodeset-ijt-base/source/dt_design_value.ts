// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This structure provides the design value for a
 * given physical quantity. It is used in
 * JointDesignDataType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |DesignValueDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTDesignValue extends DTStructure {
  /** It is the physical quantity of the value. Example: Force, Angle, etc.*/
  physicalQuantity?: Byte; // Byte ns=0;i=3
  /** It is the name of the given value.*/
  name?: UAString; // String ns=0;i=12
  /** It is the design value. The data type can be any simple data type such as Integer, String, Double, DateTime, etc. If the value is corresponding to the physical quantity, then the data type should be Double.*/
  designValue?: VariantOptions; // Variant ns=0;i=0
  /** It is the engineering unit of the design value.*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
}
export interface UDTDesignValue extends ExtensionObject, DTDesignValue {};