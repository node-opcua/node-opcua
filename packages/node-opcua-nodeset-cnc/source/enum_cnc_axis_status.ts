// ----- this file has been automatically generated - do not edit

/**
 * Status of a CNC axis.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/CNC                   |
 * | nodeClass |DataType                                          |
 * | name      |11:CncAxisStatus                                  |
 * | isAbstract|false                                             |
 */
export enum EnumCncAxisStatus  {
  /**
   * Axis reached commanded position
   */
  InPosition = 0,
  /**
   * Axis is moving to reach commanded position
   */
  Moving = 1,
  /**
   * Axis is configured but not active
   */
  Parked = 2,
}