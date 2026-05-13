import type { ExtensionObject } from "node-opcua-extension-object";

import type { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates";
import type { DT3DOrientation } from "./dt_3_d_orientation";
import type { DTFrame } from "./dt_frame";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |3DFrame                                                     |
 * | isAbstract|false                                                       |
 */
export interface DT3DFrame extends DTFrame {
  cartesianCoordinates: DT3DCartesianCoordinates; // ExtensionObject ns=0;i=18810
  orientation: DT3DOrientation; // ExtensionObject ns=0;i=18812
}
export interface UDT3DFrame extends ExtensionObject, DT3DFrame {};