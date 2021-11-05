// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |NegotiationStatus                                 |
 * | isAbstract|false                                             |
 */
export enum EnumNegotiationStatus  {
  /**
   * The auto-negotiation protocol is running and
   * negotiation is currently in-progress.
   */
  InProgress = 0,
  /**
   * The auto-negotiation protocol has completed
   * successfully.
   */
  Complete = 1,
  /**
   * The auto-negotiation protocol has failed.
   */
  Failed = 2,
  /**
   * The auto-negotiation status is not currently
   * known, this could be because it is still
   * negotiating or the protocol cannot run (e.g., if
   * no medium is present).
   */
  Unknown = 3,
  /**
   * No auto-negotiation is executed. The
   * auto-negotiation function is either not supported
   * on this interface or has not been enabled.
   */
  NoNegotiation = 4,
}