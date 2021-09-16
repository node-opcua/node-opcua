// ----- this file has been automatically generated - do not edit

/**
 * Status of a CNC spindle.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/CNC                   |
 * | nodeClass |DataType                                          |
 * | name      |11:CncSpindleStatus                               |
 * | isAbstract|false                                             |
 */
export enum EnumCncSpindleStatus  {
  /**
   * Spindle stopped
   */
  Stopped = 0,
  /**
   * Spindle reached commanded velocity
   */
  InTargetArea = 1,
  /**
   * Spindle accelerating
   */
  Accelerating = 2,
  /**
   * Spindle decelerating
   */
  Decelerating = 3,
  /**
   * Spindle configured but not active
   */
  Parked = 4,
}