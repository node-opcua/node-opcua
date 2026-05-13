import type { UASimpleScale, UASimpleScale_Base } from "./ua_simple_scale";

// ----- this file has been automatically generated - do not edit
/**
 * Represents a weighing bridge.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WeighingModuleType i=1                                      |
 * |isAbstract      |false                                                       |
 */
export type UAWeighingModule_Base = UASimpleScale_Base;
export interface UAWeighingModule extends UASimpleScale, UAWeighingModule_Base {}