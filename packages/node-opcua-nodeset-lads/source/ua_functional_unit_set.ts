import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The FunctionalUnitSetType provides a set of a
 * FunctionalUnit objects.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionalUnitSetType i=1023                                |
 * |isAbstract      |false                                                       |
 */
export type UAFunctionalUnitSet_Base = UASet_Base;
export interface UAFunctionalUnitSet extends Omit<UASet, "$SetElement$">, UAFunctionalUnitSet_Base {}