import type { UABaseLifetimeIndication, UABaseLifetimeIndication_Base } from "./ua_base_lifetime_indication";

// ----- this file has been automatically generated - do not edit
/**
 * Indicates the time the entity has been in use or
 * can still be used
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TimeIndicationType i=474                                    |
 * |isAbstract      |true                                                        |
 */
export type UATimeIndication_Base = UABaseLifetimeIndication_Base;
export interface UATimeIndication extends UABaseLifetimeIndication, UATimeIndication_Base {}