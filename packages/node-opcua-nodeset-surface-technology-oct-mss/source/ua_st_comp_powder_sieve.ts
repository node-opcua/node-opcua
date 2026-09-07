import type { UASTComp, UASTComp_Base } from "node-opcua-nodeset-surface-technology-general-types/dist/ua_st_comp";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UASTCompPowderSieve_$description extends UAFolder { // Object
      powderSieveMeshSize?: UAAnalogUnit<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/OCT-MSS/      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STCompPowderSieveType i=1008                                |
 * |isAbstract      |false                                                       |
 */
export interface UASTCompPowderSieve_Base extends UASTComp_Base {
    "$description"?: UASTCompPowderSieve_$description;
}
export interface UASTCompPowderSieve extends Omit<UASTComp, "$description">, UASTCompPowderSieve_Base {}