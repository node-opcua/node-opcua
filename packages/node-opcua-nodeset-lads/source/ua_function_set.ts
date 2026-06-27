import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The FunctionSetType is used for organising
 * FunctionType objects in an unordered list
 * structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionSetType i=1026                                      |
 * |isAbstract      |false                                                       |
 */
export type UAFunctionSet_Base = UASet_Base;
export interface UAFunctionSet extends Omit<UASet, "$SetElement$">, UAFunctionSet_Base {}