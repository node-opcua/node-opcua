import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The SupportedPropertiesSetType provides a set of
 * properties which are supported as members of a
 * properties list Argument for Method calls such
 * as, FunctionalUnit.StartFunctions() or
 * ActiveProgram.Start().
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SupportedPropertiesSetType i=1033                           |
 * |isAbstract      |false                                                       |
 */
export type UASupportedPropertiesSet_Base = UASet_Base;
export interface UASupportedPropertiesSet extends Omit<UASet, "$SetElement$">, UASupportedPropertiesSet_Base {}