import type { UABaseLifetimeIndication, UABaseLifetimeIndication_Base } from "./ua_base_lifetime_indication";

// ----- this file has been automatically generated - do not edit
/**
 * Indicates the abraded length, for example of a
 * drill.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LengthIndicationType i=477                                  |
 * |isAbstract      |true                                                        |
 */
export type UALengthIndication_Base = UABaseLifetimeIndication_Base;
export interface UALengthIndication extends UABaseLifetimeIndication, UALengthIndication_Base {}