// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ChassisIdSubtype                                            |
 * | isAbstract|false                                                       |
 */
export enum EnumChassisIdSubtype  {
  /**
   * Represents a chassis identifier based on the
   * value of entPhysicalAlias object (defined in IETF
   * RFC 2737) for a chassis component (i.e., an
   * entPhysicalClass value of chassis(3))
   */
  ChassisComponent = 1,
  /**
   * Represents a chassis identifier based on the
   * value of ifAlias object (defined in IETF RFC
   * 2863) for an interface on the containing chassis.
   */
  InterfaceAlias = 2,
  /**
   * Represents a chassis identifier based on the
   * value of entPhysicalAlias object (defined in IETF
   * RFC 2737) for a port or backplane component
   * (i.e., entPhysicalClass has a value of port(10),
   * or backplane(4)), within the containing chassis.
   */
  PortComponent = 3,
  /**
   * Represents a chassis identifier based on the
   * value of a unicast source address (encoded in
   * network byte order and IEEE 802.3 canonical bit
   * order) of a port on the containing chassis as
   * defined in IEEE Std 802-2014.
   */
  MacAddress = 4,
  /**
   * Represents a chassis identifier based on a
   * network address associated with a particular
   * chassis. The encoded address is actually composed
   * of two fields. The first field is a single octet,
   * representing the IANA AddressFamilyNumbers value
   * for the specific address type, and the second
   * field is the network address value.
   */
  NetworkAddress = 5,
  /**
   * Represents a chassis identifier based on the
   * value of ifName object (defined in IETF RFC 2863)
   * for an interface on the containing chassis.
   */
  InterfaceName = 6,
  /**
   * Represents a chassis identifier based on a
   * locally defined value.
   */
  Local = 7,
}