// ----- this file has been automatically generated - do not edit

/**
 * Status of program execution within a channel.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/CNC                   |
 * | nodeClass |DataType                                          |
 * | name      |11:CncChannelProgramStatus                        |
 * | isAbstract|false                                             |
 */
export enum EnumCncChannelProgramStatus  {
  /**
   * Channel program stopped
   */
  Stopped = 0,
  /**
   * Channel program running
   */
  Running = 1,
  /**
   * Channel program in waiting state
   */
  Waiting = 2,
  /**
   * Channel program interrupted
   */
  Interrupted = 3,
  /**
   * Channel program canceled
   */
  Canceled = 4,
}