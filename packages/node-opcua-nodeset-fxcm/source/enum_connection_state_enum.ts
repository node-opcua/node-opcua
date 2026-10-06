// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionStateEnum                                         |
 * | isAbstract|false                                                       |
 */
export enum EnumConnectionStateEnum  {
  /**
   * ConnectionManager does not monitor the state of
   * the Connection
   */
  ConnectionNotMonitored = 0,
  /**
   * Connection does not exist
   */
  ConnectionNotEstablished = 1,
  /**
   * Connection is being established, but
   * communication model is not linked to
   * ConnectionEndpoint
   */
  ConnectionInitial = 2,
  /**
   * Connection is established but communication model
   * is disabled
   */
  ConnectionReady = 3,
  /**
   * Connection is established and enabled, but
   * communication has not started
   */
  ConnectionPreOperational = 4,
  /**
   * Connection is established and communication is
   * flowing
   */
  ConnectionOperational = 5,
  /**
   * Connection is established and enabled, but
   * communication is not possible due to an endpoint
   * error
   */
  ConnectionError = 6,
}