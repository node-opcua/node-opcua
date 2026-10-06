// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConnectionEndpointModeEnum                            |
 * | isAbstract|false                                                       |
 */
export enum EnumPubSubConnectionEndpointModeEnum  {
  /**
   * reference to DataSetReader and DataSetWriter
   * required.
   */
  PublisherSubscriber = 1,
  /**
   * reference to DataSetWriter is required.
   */
  Publisher = 2,
  /**
   * reference to DataSetReader is required.
   */
  Subscriber = 3,
}