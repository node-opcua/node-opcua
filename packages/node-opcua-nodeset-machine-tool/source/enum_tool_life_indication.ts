// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:ToolLifeIndication                             |
 * | isAbstract|false                                             |
 */
export enum EnumToolLifeIndication  {
  /**
   * The tool life indicates the time the tool has
   * been in use or can still be used. The value shall
   * be given in hours (decimal value).
   */
  Time = 0,
  /**
   * The tool life indicates the total number of parts
   * that have been produced or can still be produced
   * using the tool. The unit shall be “one”.
   */
  NumberOfParts = 1,
  /**
   * The tool life indicates counting the process
   * steps this tool has been used or can still be
   * used (for example usages of a punching tool). The
   * unit shall be “one”.
   */
  NumberOfUsages = 2,
  /**
   * The tool life indicates the sum of the feed path
   * covered by the tool and the workpiece relative to
   * each other during machining. This value shall be
   * given in one of the following units: millimetres,
   * metres, kilometres.
   */
  Feed_Distance = 3,
  /**
   * The tool life indicates the sum of the lengths
   * that the cutting knife works in the workpiece. If
   * the knife is not fixed, this includes the lengths
   * of the arc segments of the knife path. This value
   * shall be given in one of the following units:
   * millimetres, metres, kilometres. This value is
   * likely only available for serial production with
   * clearly defined machining conditions.
   */
  Cutting_Distance = 4,
  /**
   * The tool life indicates the abraded length of the
   * tool. This value shall be given in one of the
   * following units: micrometres, millimetres,
   * metres, kilometres.
   */
  Length = 5,
  /**
   * The tool life indicates the abraded diameter of
   * the tool. This value shall be given in one of the
   * following units: micrometres, millimetres,
   * metres, kilometres.
   */
  Diameter = 6,
  /**
   * The tool life is indicated in a way not covered
   * by the remaining enum values.
   */
  Other = 7,
}