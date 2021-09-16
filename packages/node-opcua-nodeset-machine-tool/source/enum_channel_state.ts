// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:ChannelState                                   |
 * | isAbstract|false                                             |
 */
export enum EnumChannelState  {
  /**
   * There is an active command being executed by the
   * NC channel.
   */
  Active = 0,
  /**
   * The NC execution is interrupted. Execution of a
   * program in the channel can be restarted.
   */
  Interrupted = 1,
  /**
   * No NC command is active in the NC channel. E.g.
   * channel is idle.
   */
  Reset = 2,
}