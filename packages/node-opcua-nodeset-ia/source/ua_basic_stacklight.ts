import type { UAProperty } from "node-opcua-address-space-base";
import type { UAOrderedList, UAOrderedList_Base } from "node-opcua-nodeset-ua/dist/ua_ordered_list";
import type { DataType } from "node-opcua-variant";

import type { EnumStacklightOperationMode } from "./enum_stacklight_operation_mode";
import type { UAStackLevel } from "./ua_stack_level";
import type { UAStackRunning } from "./ua_stack_running";

// ----- this file has been automatically generated - do not edit

/**
 * Entry point to a stacklight containing elements
 * of the stacklight as well as additional
 * information valid for the whole unit.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |BasicStacklightType i=1002                                  |
 * |isAbstract      |false                                                       |
 */
export interface UABasicStacklight_Base extends UAOrderedList_Base {
   // PlaceHolder for $OrderedObject$
    /**
     * stackLevel
     * Valid if the stacklight is used in “Levelmeter”
     * StacklightMode. If so, the whole stack is
     * controlled by a single percentual value. In this
     * case, the SignalOn parameter of any stack element
     * of StackElementLightType has no meaning.
     */
    stackLevel?: UAStackLevel;
    /**
     * stacklightMode
     * Shows in what way (stack of individual lights,
     * level meter, running light) the stacklight unit
     * is used.
     */
    stacklightMode: UAProperty<EnumStacklightOperationMode, DataType.Int32>;
    /**
     * stackRunning
     * Valid if the stacklight is used in
     * “Running_Light” StacklightMode.
     */
    stackRunning?: UAStackRunning;
}
export interface UABasicStacklight extends Omit<UAOrderedList, "$OrderedObject$">, UABasicStacklight_Base {}