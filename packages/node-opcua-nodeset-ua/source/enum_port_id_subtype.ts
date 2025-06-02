// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PortIdSubtype                                               |
 * | isAbstract|false                                                       |
 */
export enum EnumPortIdSubtype  {
  /**
   * Represents a port identifier based on the ifAlias
   * MIB object defined in IETF RFC 2863.
   */
  InterfaceAlias = 1,
  /**
   * Represents a port identifier based on the value
   * of entPhysicalAlias (defined in IETF RFC 2737)
   * for a port component (i.e., entPhysicalClass
   * value of port(10) or backplane(4)), within the
   * containing chassis.
   */
  PortComponent = 2,
  /**
   * Represents a port identifier based on a unicast
   * source address (encoded in network byte order and
   * IEEE 802.3 canonical bit order) which has been
   * detected by the agent and associated with a
   * particular port (IEEE Std 802-2014).
   */
  MacAddress = 3,
  /**
   * Represents a port identifier based on a network
   * address, detected by the agent and associated
   * with a particular port.
   */
  NetworkAddress = 4,
  /**
   * Represents a port identifier based on the ifName
   * MIB object, defined in IETF RFC 2863.
   */
  InterfaceName = 5,
  /**
   * Represents a port identifier based on the
   * agent-local identifier of the circuit (defined in
   * IETF RFC 3046), detected by the agent and
   * associated with a particular port.
   */
  AgentCircuitId = 6,
  /**
   * Represents a port identifier based on a value
   * locally assigned.
   */
  Local = 7,
}