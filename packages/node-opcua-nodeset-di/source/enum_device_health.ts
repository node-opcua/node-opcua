// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/DI/                   |
 * | nodeClass |DataType                                          |
 * | name      |1:DeviceHealthEnumeration                         |
 * | isAbstract|false                                             |
 */
export enum EnumDeviceHealth  {
  /**
   * This device functions normally.
   */
  NORMAL = 0,
  /**
   * Malfunction of the device or any of its
   * peripherals.
   */
  FAILURE = 1,
  /**
   * Functional checks are currently performed.
   */
  CHECK_FUNCTION = 2,
  /**
   * The device is currently working outside of its
   * specified range or that internal diagnoses
   * indicate deviations from measured or set values.
   */
  OFF_SPEC = 3,
  /**
   * This element is working, but a maintenance
   * operation is required.
   */
  MAINTENANCE_REQUIRED = 4,
}