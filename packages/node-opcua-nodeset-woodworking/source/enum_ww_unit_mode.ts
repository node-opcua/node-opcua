// ----- this file has been automatically generated - do not edit

/**
 * This enumeration represents the generalized mode
 * of a unit.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Woodworking/          |
 * | nodeClass |DataType                                          |
 * | name      |12:WwUnitModeEnumeration                          |
 * | isAbstract|false                                             |
 */
export enum EnumWwUnitMode  {
  /**
   * This state is used if none of the other states
   * below applies.
   */
  OTHER = 0,
  /**
   * The unit is in automatic mode.
   */
  AUTOMATIC = 1,
  /**
   * The unit is in semi-automatic mode.
   */
  SEMIAUTOMATIC = 2,
  /**
   * The unit is in manual mode.
   */
  MANUAL = 3,
  /**
   * The unit is in setup mode.
   */
  SETUP = 4,
  /**
   * The unit is in sleep mode. Component is still
   * switched on, energy consumption reduced by e.g.
   * reducing heating, switching drives off.
   * Production is not possible.
   */
  SLEEP = 5,
}