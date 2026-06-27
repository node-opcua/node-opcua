import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The VariableSetType is used for storing
 * additional sample data that was created during a
 * run.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VariableSetType i=1041                                      |
 * |isAbstract      |false                                                       |
 */
export type UAVariableSet_Base = UASet_Base;
export interface UAVariableSet extends Omit<UASet, "$SetElement$">, UAVariableSet_Base {}