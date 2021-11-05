// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |TsnStreamState                                    |
 * | isAbstract|false                                             |
 */
export enum EnumTsnStreamState  {
  /**
   * The related TSN Stream is currently disabled.
   */
  Disabled = 0,
  /**
   * The related TSN Stream is in the process of
   * receiving configuration parameters from the TSN
   * Control Layer.
   */
  Configuring = 1,
  /**
   * The related TSN Stream has successfully received
   * and applied the configuration from the TSN
   * Control Layer. The related TSN Stream is not
   * fully operational as long as local preconditions
   * (e.g. synchronization state) are not valid.
   */
  Ready = 2,
  /**
   * The related TSN Stream object is configured and
   * all other required preconditions (e.g.
   * synchronization state) for sending / receiving
   * data are valid.
   */
  Operational = 3,
  /**
   * The related TSN Stream object is in an error
   * state.
   */
  Error = 4,
}