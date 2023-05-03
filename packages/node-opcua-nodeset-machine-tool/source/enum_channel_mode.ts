// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/                    |
 * | nodeClass |DataType                                                    |
 * | name      |10:ChannelMode                                              |
 * | isAbstract|false                                                       |
 */
export enum EnumChannelMode  {
  /**
   * NC channel mode Automatic – execute CNC part
   * programs.
   */
  Automatic = 0,
  /**
   * NC channel mode Mda/Mdi – manual data input and
   * execution.
   */
  MdaMdi = 1,
  /**
   * NC channel mode Jog Manual – axis movement
   * triggered by user.
   */
  JogManual = 2,
  /**
   * NC channel mode Jog Increment – incremental axis
   * movement triggered by user.
   */
  JogIncrement = 3,
  /**
   * NC channel mode Teaching Handle – teaching a
   * machine tool by moving axes of the machine tool
   * by hand.
   */
  TeachingHandle = 4,
  /**
   * NC channel mode Remote – the machine tool can
   * receive CNC files via a remote access mechanism.
   */
  Remote = 5,
  /**
   * NC channel mode Reference – The machine tool
   * returns to its reference point/ zero position.
   */
  Reference = 6,
  /**
   * NC channel mode is different from the values
   * defined in this enumeration.
   */
  Other = 7,
}