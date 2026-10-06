// ----- this file has been automatically generated - do not edit

/**
 * This enumeration defines the values of the
 * FlcConnectionStatus of an
 * FlcConnectionEndpointType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionEndpointStatusEnum                                |
 * | isAbstract|false                                                       |
 */
export enum EnumConnectionEndpointStatusEnum  {
  /**
   * Initial status of the logical connection. No
   * communication-model objects referenced.
   */
  Initial = 0,
  /**
   * Logical connection is ready to operate,
   * Communication-model objects are referenced but
   * not enabled.
   */
  Ready = 1,
  /**
   * PreOperational status of the logical connection,
   * Data output is active, but no input data received.
   */
  PreOperational = 2,
  /**
   * Operational status of the logical connection,
   * Data output is active, and input data has been
   * received.
   */
  Operational = 3,
  /**
   * The logical connection has encountered an Error.
   */
  Error = 4,
}