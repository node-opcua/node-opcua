// ----- this file has been automatically generated - do not edit
import { DTFrame } from "./dt_frame"
import { DT3DCartesianCoordinates } from "./dt_3_d_cartesian_coordinates"
import { DT3DOrientation } from "./dt_3_d_orientation"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |3DFrame                                           |
 * | isAbstract|false                                             |
 */
export interface DT3DFrame extends DTFrame  {
  cartesianCoordinates: DT3DCartesianCoordinates; // ExtensionObject ns=0;i=18810
  orientation: DT3DOrientation; // ExtensionObject ns=0;i=18812
}