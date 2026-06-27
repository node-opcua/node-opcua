import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The ResultFileSetType is used for organising
 * ResultFileType objects in an unordered list
 * structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ResultFileSetType i=1022                                    |
 * |isAbstract      |false                                                       |
 */
export type UAResultFileSet_Base = UASet_Base;
export interface UAResultFileSet extends Omit<UASet, "$SetElement$">, UAResultFileSet_Base {}