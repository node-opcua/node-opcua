// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Robotics/             |
 * | nodeClass |DataType                                          |
 * | name      |7:OperationalModeEnumeration                      |
 * | isAbstract|false                                             |
 */
export enum EnumOperationalMode  {
  /**
   * Other for when there is a system-boot (unknown)
   * or a failure of the safety, there is no valid
   * operational mode.
   */
  OTHER = 0,
  /**
   * "Manual reduced speed" - name according to ISO
   * 10218-1:2011.
   */
  MANUAL_REDUCED_SPEED = 1,
  /**
   * "Manual high speed" - name according to ISO
   * 10218-1:2011.
   */
  MANUAL_HIGH_SPEED = 2,
  /**
   * "Automatic" - name according to ISO 10218-1:2011.
   */
  AUTOMATIC = 3,
  /**
   * "Automatic external" - Same as "Automatic" but
   * with external control, e.g. by a PLC.
   */
  AUTOMATIC_EXTERNAL = 4,
}