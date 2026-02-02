// ----- this file has been automatically generated - do not edit
import { Byte } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IA/                             |
 * | nodeClass |DataType                                                    |
 * | name      |RGBWDataType                                                |
 * | isAbstract|false                                                       |
 */
export interface DTRGBW extends DTStructure {
  /** Defines the intensity of the colour red*/
  red: Byte; // Byte ns=0;i=3
  /** Defines the intensity of the colour green*/
  green: Byte; // Byte ns=0;i=3
  /** Defines the intensity of the colour blue*/
  blue: Byte; // Byte ns=0;i=3
  /** Defines the intensity of an additional white component. Shall be not provided when using RGB.*/
  white?: Byte; // Byte ns=0;i=3
}
export interface UDTRGBW extends ExtensionObject, DTRGBW {};