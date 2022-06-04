// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |IdentityCriteriaType                              |
 * | isAbstract|false                                             |
 */
export enum EnumIdentityCriteria  {
  /**
   * The rule specifies a UserName from a
   * UserNameIdentityToken.
   */
  UserName = 1,
  /**
   * The rule specifies the Thumbprint of a user or CA
   * Certificate.
   */
  Thumbprint = 2,
  /**
   * The rule is a Role specified in an Access Token.
   */
  Role = 3,
  /**
   * The rule is a user group specified in the Access
   * Token.
   */
  GroupId = 4,
  /**
   * The rule specifies Anonymous UserIdentityToken.
   */
  Anonymous = 5,
  /**
   * The rule specifies any non Anonymous
   * UserIdentityToken.
   */
  AuthenticatedUser = 6,
  /**
   * The rule specifies the combination of an
   * application identity and an Anonymous
   * UserIdentityToken.
   */
  Application = 7,
  /**
   * The rule specifies the X509 subject name of a
   * user or CA Certificate.
   */
  X509Subject = 8,
}