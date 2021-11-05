// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |InterfaceOperStatus                               |
 * | isAbstract|false                                             |
 */
export enum EnumInterfaceOperStatus  {
  /**
   * Ready to pass packets.
   */
  Up = 0,
  /**
   * The interface does not pass any packets.
   */
  Down = 1,
  /**
   * In some test mode. No operational packets can be
   * passed.
   */
  Testing = 2,
  /**
   * Status cannot be determined for some reason.
   */
  Unknown = 3,
  /**
   * Waiting for some external event.
   */
  Dormant = 4,
  /**
   * Some component (typically hardware) is missing.
   */
  NotPresent = 5,
  /**
   * Down due to state of lower-layer interface(s).
   */
  LowerLayerDown = 6,
}