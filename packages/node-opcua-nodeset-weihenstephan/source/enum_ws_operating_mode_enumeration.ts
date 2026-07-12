// ----- this file has been automatically generated - do not edit

/**
 * The operating mode provides information about the
 * nature and extent of the intervention on the
 * control equipment by the operators, and also via
 * feedback from the equipment (DIN 19 237). This
 * value must be coded in bit form or be documented
 * as an integer for machines which are components
 * of bottling systems:
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Weihenstephan/                  |
 * | nodeClass |DataType                                                    |
 * | name      |WSOperatingModeEnumerationType                              |
 * | isAbstract|false                                                       |
 */
export enum EnumWSOperatingModeEnumeration  {
  /**
   * The machine state (in the Weihenstephan Standards
   * the machine state is understood to be the
   * operating mode) provides information about
   * whether the machine is off (Off: relevant bit = 1
   * or identification by the documented integer
   * number). If this bit is not set, then the machine
   * is in operation and is in one of the following
   * operating modes.
   */
  Off = 1,
  /**
   * An operating mode in which the control units only
   * operate with intervention by the operator and
   * involve possible locking mechanisms (DIN 19237).
   * As opposed to the DIN standard, in the context of
   * the Weihenstephan Standards this term also
   * includes the setup mode, the step setting mode
   * and tipping mode.
   */
  Manual = 2,
  /**
   * An operating mode in which only some of the
   * controls or part of the program function without
   * intervention by the operator (DIN 19 237). In the
   * context of the Weihenstephan Standards, this term
   * means that the machines of a bottling plant are
   * not integrated into a control concept for the
   * entire system and the set output is manually
   * controlled on site.
   */
  "Semi-automatic" = 4,
  /**
   * An operating mode in which the control unit
   * operates without intervention by the operator
   * following a set of control procedures (DIN 19
   * 237). In the context of the Weihenstephan
   * Standards this term means that the machines of a
   * production plant are integrated into a control
   * concept for the entire system and the set output
   * is automatically controlled.
   */
  Automatic = 8,
}