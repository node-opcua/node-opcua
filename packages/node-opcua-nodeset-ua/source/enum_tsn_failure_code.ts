// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |TsnFailureCode                                    |
 * | isAbstract|false                                             |
 */
export enum EnumTsnFailureCode  {
  /**
   * No failure
   */
  NoFailure = 0,
  /**
   * Insufficient bandwidth
   */
  InsufficientBandwidth = 1,
  /**
   * Insufficient bridge resources
   */
  InsufficientResources = 2,
  /**
   * Insufficient bandwidth for Traffic Class
   */
  InsufficientTrafficClassBandwidth = 3,
  /**
   * StreamID in use by another Talker
   */
  StreamIdInUse = 4,
  /**
   * Stream destination address already in use
   */
  StreamDestinationAddressInUse = 5,
  /**
   * Stream pre-empted by higher rank
   */
  StreamPreemptedByHigherRank = 6,
  /**
   * Reported latency has changed
   */
  LatencyHasChanged = 7,
  /**
   * Egress port is not AVBCapable
   */
  EgressPortNotAvbCapable = 8,
  /**
   * Use a different destination address
   */
  UseDifferentDestinationAddress = 9,
  /**
   * Out of MSRP resources
   */
  OutOfMsrpResources = 10,
  /**
   * Out of MMRP resources
   */
  OutOfMmrpResources = 11,
  /**
   * Cannot store destination address
   */
  CannotStoreDestinationAddress = 12,
  /**
   * Requested priority is not an SR Class priority
   */
  PriorityIsNotAnSrcClass = 13,
  /**
   * MaxFrameSize is too large for media
   */
  MaxFrameSizeTooLarge = 14,
  /**
   * MaxFanInPorts limit has been reached
   */
  MaxFanInPortsLimitReached = 15,
  /**
   * Changes in FirstValue for a registered StreamID
   */
  FirstValueChangedForStreamId = 16,
  /**
   * VLAN is blocked on this egress port (Registration
   * Forbidden)
   */
  VlanBlockedOnEgress = 17,
  /**
   * VLAN tagging is disabled on this egress port
   * (untagged set)
   */
  VlanTaggingDisabledOnEgress = 18,
  /**
   * SR class priority mismatch
   */
  SrClassPriorityMismatch = 19,
  /**
   * Enhanced feature cannot be propagated to original
   * Port
   */
  FeatureNotPropagated = 20,
  /**
   * MaxLatency exceeded
   */
  MaxLatencyExceeded = 21,
  /**
   * Nearest Bridge cannot provide network
   * identification for stream transformation
   */
  BridgeDoesNotProvideNetworkId = 22,
  /**
   * Stream transformation not supported
   */
  StreamTransformNotSupported = 23,
  /**
   * Stream identification type not supported for
   * stream transformation
   */
  StreamIdTypeNotSupported = 24,
  /**
   * Enhanced feature cannot be supported without a CNC
   */
  FeatureNotSupported = 25,
}