// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ADI/                  |
 * | nodeClass |DataType                                          |
 * | name      |2:ExecutionCycleEnumeration                       |
 * | isAbstract|false                                             |
 */
export enum EnumExecutionCycle  {
  /**
   * Idle, no cleaning or acquisition cycle in progress
   */
  IDLE = 0,
  /**
   * Scquisition cycle collecting data for diagnostic
   * purpose
   */
  DIAGNOSTIC = 1,
  /**
   * Cleaning cycle
   */
  CLEANING = 2,
  /**
   * Calibration acquisition cycle
   */
  CALIBRATION = 4,
  /**
   * Validation acquisition cycle
   */
  VALIDATION = 8,
  /**
   * Sample acquisition cycle
   */
  SAMPLING = 16,
  /**
   * Scquisition cycle collecting data for diagnostic
   * purpose and sample is extracted from the process
   * to be sent in control lab
   */
  DIAGNOSTIC_WITH_GRAB_SAMPLE = 32769,
  /**
   * Cleaning cycle with or without acquisition and
   * sample is extracted from the process to be sent
   * in control lab
   */
  CLEANING_WITH_GRAB_SAMPLE = 32770,
  /**
   * Calibration acquisition cycle and sample is
   * extracted from the process to be sent in control
   * lab
   */
  CALIBRATION_WITH_GRAB_SAMPLE = 32772,
  /**
   * Validation acquisition cycle and sample is
   * extracted from the process to be sent in control
   * lab
   */
  VALIDATION_WITH_GRAB_SAMPLE = 32776,
  /**
   * Sample acquisition cycle and sample is extracted
   * from the process to be sent in control lab
   */
  SAMPLING_WITH_GRAB_SAMPLE = 32784,
}