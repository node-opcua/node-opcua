// ----- this file has been automatically generated - do not edit
import { UABaseLifetimeIndication, UABaseLifetimeIndication_Base } from "./ua_base_lifetime_indication"
/**
 * Indicates the time the entity has been in use or
 * can still be used
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:TimeIndicationType ns=1;i=474                   |
 * |isAbstract      |true                                              |
 */
export type UATimeIndication_Base = UABaseLifetimeIndication_Base;
export interface UATimeIndication extends UABaseLifetimeIndication, UATimeIndication_Base {
}