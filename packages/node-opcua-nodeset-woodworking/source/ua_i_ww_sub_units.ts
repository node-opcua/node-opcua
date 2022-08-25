// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
export interface UAIWwSubUnits_$SubUnit$ extends UAObject { // Object
      /**
       * flags
       * The Flags Object provides the flags of the unit.
       */
      flags?: UAObject;
      /**
       * overview
       * The Overview Object provides a general overview
       * of the unit.
       */
      overview: UAObject;
      /**
       * values
       * The Values Object provides the counters of the
       * unit.
       */
      values?: UAObject;
}
/**
 * The IWwSubUnitsType provides a list of subUnits.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwSubUnitsType ns=12;i=7                      |
 * |isAbstract      |true                                              |
 */
export type UAIWwSubUnits_Base = UABaseInterface_Base;
export interface UAIWwSubUnits extends UABaseInterface, UAIWwSubUnits_Base {
}