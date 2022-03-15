// ----- this file has been automatically generated - do not edit

/**
 * This enumeration represents the generalized state
 * of a unit.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Woodworking/          |
 * | nodeClass |DataType                                          |
 * | name      |12:WwUnitStateEnumeration                         |
 * | isAbstract|false                                             |
 */
export enum EnumWwUnitState  {
  /**
   * The component is offline.
   */
  OFFLINE = 0,
  /**
   * The unit is in standby.
   */
  STANDBY = 1,
  /**
   * The unit is ready to start working.
   */
  READY = 2,
  /**
   * The unit is working.
   */
  WORKING = 3,
  /**
   * The unit is not able to start working because
   * there is an error. The cause can be an alarm or
   * error or user intervention.
   */
  ERROR = 4,
}