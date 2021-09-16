// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:PartQuality                                    |
 * | isAbstract|false                                             |
 */
export enum EnumPartQuality  {
  /**
   * The machine tool is not able to give a statement
   * about the part quality.
   */
  CapabilityUnavailable = 0,
  /**
   * The part quality is determined good.
   */
  Good = 1,
  /**
   * The part quality is determined bad.
   */
  Bad = 2,
  /**
   * The PartQuality will still be determined in the
   * machine tool to be either Good or Bad.
   */
  NotYetMeasured = 3,
  /**
   * The machine tool will not give a statement about
   * the part quality.
   */
  WillNotBeMeasured = 4,
}