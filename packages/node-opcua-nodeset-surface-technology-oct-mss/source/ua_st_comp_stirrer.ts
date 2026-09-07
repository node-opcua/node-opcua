import type { UAMonitoring } from "node-opcua-nodeset-machinery/dist/ua_monitoring";
import type { UASTComp, UASTComp_Base } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_comp";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STCompStirrerType i=1007                                    |
 * |isAbstract      |false                                                       |
 */
export interface UASTCompStirrer_Base extends UASTComp_Base {
    monitoring?: UAMonitoring;
}
export interface UASTCompStirrer extends Omit<UASTComp, "monitoring">, UASTCompStirrer_Base {}