// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:LaserState                                     |
 * | isAbstract|false                                             |
 */
export enum EnumLaserState  {
  /**
   * The laser state cannot be indicated, for example
   * because the device does not provide this
   * information
   * or because it is currently unavailable. This can
   * be e.g. during the startup phase.
   */
  Undefined = 0,
  /**
   * The laser is ready and laser programs can be
   * started. No error state is active. In this state,
   * laser
   * emission is prohibited.
   */
  Ready = 1,
  /**
   * In this state, safety clearances have to be set
   * for processing and emission can be activated.
   * For devices that can run programs themselves it
   * indicates that a program is running on the laser
   * device.
   */
  Active = 2,
  /**
   * An error state is reported from the laser device.
   */
  Error = 3,
}