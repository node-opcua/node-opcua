import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The ControllerParameterSetType is used for
 * organising ControllerParameterType objects in an
 * unordered list structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControllerParameterSetType i=1049                           |
 * |isAbstract      |false                                                       |
 */
export type UAControllerParameterSet_Base = UASet_Base;
export interface UAControllerParameterSet extends Omit<UASet, "$SetElement$">, UAControllerParameterSet_Base {}