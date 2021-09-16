// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineTool/          |
 * | nodeClass |DataType                                          |
 * | name      |10:EDMGeneratorState                              |
 * | isAbstract|false                                             |
 */
export enum EnumEDMGeneratorState  {
  /**
   * The EDM spark generator state cannot be indicated.
   */
  Undefined = 0,
  /**
   * Generator is initialized and can receive a set of
   * technology parameters.
   */
  Ready = 1,
  /**
   * Generator is switched on and is supplying pulses
   * respecting the low voltage (b    $ 25 V AC or
   * b    $ 60 V DC) requirements of safety standard
   * (ISO 28881).
   */
  Active_Low_Voltage = 2,
  /**
   * Generator is switched on and is supplying pulse
   * at high voltage (> 25 V AC or > 60 V DC).
   */
  Active_High_Voltage = 3,
  /**
   * Generator is in an error state.
   */
  Error = 4,
}