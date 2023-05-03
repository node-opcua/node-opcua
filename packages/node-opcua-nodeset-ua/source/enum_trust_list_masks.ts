// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |TrustListMasks                                              |
 * | isAbstract|false                                                       |
 */
export enum EnumTrustListMasks  {
  /**
   * No fields are provided.
   */
  None = 0,
  /**
   * The TrustedCertificates are provided.
   */
  TrustedCertificates = 1,
  /**
   * The TrustedCrls are provided.
   */
  TrustedCrls = 2,
  /**
   * The IssuerCertificates are provided.
   */
  IssuerCertificates = 4,
  /**
   * The IssuerCrls are provided.
   */
  IssuerCrls = 8,
  /**
   * All fields are provided.
   */
  All = 15,
}