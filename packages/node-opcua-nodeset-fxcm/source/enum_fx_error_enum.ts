// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |FxErrorEnum                                                 |
 * | isAbstract|false                                                       |
 */
export enum EnumFxErrorEnum  {
  /**
   * This is returned if no processing has been done
   * or no error exists
   */
  NoError = 0,
  /**
   * The Connection is not monitored and its status is
   * unknown
   */
  UnknownStatus = 1,
  /**
   * The Connection was successfully established but
   * was rolled back due to errors in related
   * Connections in this ConnectionConfigurationSet
   */
  Rollback = 2,
  /**
   * This Connection processing was stopped due to
   * some other error in the ConnectionConfigurationSet
   */
  ProcessingStopped = 3,
  /**
   * The ConnectionManager could not process this
   * ConnectionConfigurationSet due to a configuration
   * error
   */
  ConnectionConfigurationSetInvalid = 4,
  /**
   * There was an error related to establishing a
   * session to the GDS
   */
  GdsConnectionError = 5,
  /**
   * There was an error related to processing commands
   * with the GDS
   */
  GdsProcessingError = 6,
  /**
   * There was an error related to resolving AliasNames
   */
  AliasNameProcessingError = 7,
  /**
   * There was an error related to establishing a
   * session to the SKS
   */
  ExternalSksConnectionError = 8,
  /**
   * There was an error related to configuring the SKS
   */
  ExternalSksProcessingError = 9,
  /**
   * There was an error related to establishing a
   * session to the target Server
   */
  TargetServerConnectionError = 10,
  /**
   * There was an error resolving Namespaces
   */
  ResolvingNamespacesError = 11,
  /**
   * There was an error resolving BrowsePaths
   */
  ResolvingPathsError = 12,
  /**
   * There was a verification error on an Asset
   */
  VerifyAssetError = 13,
  /**
   * There was a verification error on a
   * FunctionalEntity
   */
  VerifyFunctionalEntityError = 14,
  /**
   * There was an error creating a ConnectionEndpoint
   */
  CreateConnectionEndpointError = 15,
  /**
   * There was an error establishing control of a
   * FunctionalEntity
   */
  EstablishControlError = 16,
  /**
   * There was an error setting configuration
   * information in the FunctionalEntity
   */
  SetConfigurationDataError = 17,
  /**
   * There was an error reassigning the control of a
   * FunctionalEntity
   */
  ReassignControlError = 18,
  /**
   * There was an error related to reserving ids
   */
  ReserveCommunicationIdsError = 19,
  /**
   * There was an error related to configuring
   * communication
   */
  SetCommunicationConfigurationError = 20,
  /**
   * There was an error enabling communication
   */
  EnableCommunicationError = 21,
  /**
   * There was an error closing a connection
   */
  CloseConnectionError = 22,
  /**
   * The internal SKS is having a problem with pushing
   * keys to a target Server
   */
  LocalSksKeyPushError = 23,
  /**
   * There was an error in a running operation
   */
  RuntimeError = 24,
}