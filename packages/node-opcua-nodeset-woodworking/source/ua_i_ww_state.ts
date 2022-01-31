// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
export interface UAIWwState_machine extends UAObject { // Object
      /**
       * flags
       * The Flags Object provides the flags of the unit.
       */
      flags?: UAObject;
      /**
       * overview
       * The Overview Object provides a general state of
       * the unit.
       */
      overview: UAObject;
      /**
       * values
       * The Overview Object provides a general state of
       * the unit.
       */
      values?: UAObject;
}
/**
 * The IWwStateType provides a list of machine states
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Woodworking/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |12:IWwStateType ns=12;i=8                         |
 * |isAbstract      |true                                              |
 */
export interface UAIWwState_Base extends UABaseInterface_Base {
    /**
     * machine
     * State of the whole machine.
     */
    machine: UAIWwState_machine;
    /**
     * subUnits
     * The SubUnits Object is used when a machine has
     * multiple states. For example, a CNC machine can
     * have several places where independent jobs are
     * produced.
     */
    subUnits?: UAObject;
}
export interface UAIWwState extends UABaseInterface, UAIWwState_Base {
}