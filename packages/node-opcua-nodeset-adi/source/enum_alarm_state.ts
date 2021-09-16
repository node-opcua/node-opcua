// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ADI/                  |
 * | nodeClass |DataType                                          |
 * | name      |2:AlarmStateEnumeration                           |
 * | isAbstract|false                                             |
 */
export enum EnumAlarmState  {
  /**
   * Normal
   */
  NORMAL_0 = 0,
  /**
   * In low warning range
   */
  WARNING_LOW_1 = 1,
  /**
   * In high warning range
   */
  WARNING_HIGH_2 = 2,
  /**
   * In warning range (low or high) or some other
   * warning cause
   */
  WARNING_4 = 4,
  /**
   * In low alarm range
   */
  ALARM_LOW_8 = 8,
  /**
   * In high alarm range
   */
  ALARM_HIGH_16 = 16,
  /**
   * In alarm range (low or high) or some other alarm
   * cause
   */
  ALARM_32 = 32,
}