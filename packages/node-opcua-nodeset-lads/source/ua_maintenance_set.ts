import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit
/**
 * The MaintenanceSetType is a set containing all
 * maintenance tasks for a Device or Component
 * according to the recommendations in OPC UA
 * 10000-110.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MaintenanceSetType i=1027                                   |
 * |isAbstract      |false                                                       |
 */
export type UAMaintenanceSet_Base = UASet_Base;
export interface UAMaintenanceSet extends Omit<UASet, "$SetElement$">, UAMaintenanceSet_Base {}