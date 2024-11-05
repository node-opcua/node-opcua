// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |ProcessIrregularity                                         |
 * | isAbstract|false                                                       |
 */
export enum EnumProcessIrregularity  {
  /**
   * The machine is not able to give a statement about
   * process irregularities.
   */
  CapabilityUnavailable = 0,
  /**
   * A process irregularity has been detected.
   */
  Detected = 1,
  /**
   * There was no process irregularity detected.
   */
  NotDetected = 2,
  /**
   * A statement about the process irregularity is to
   * be expected.
   */
  NotYetDetermined = 3,
}