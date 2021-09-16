// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
/**
 * Base class for elements in a stacklight.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:StackElementType ns=9;i=1005                    |
 * |isAbstract      |true                                              |
 */
export interface UAStackElement_Base {
    /**
     * isPartOfBase
     * Indicates, if the element is contained in the
     * mounting base of the stacklight. All elements
     * contained in the mounting base shall be at the
     * beginning of the list of stack elements.
     */
    isPartOfBase?: UAProperty<boolean, /*z*/DataType.Boolean>;
    /**
     * numberInList
     * Enumerate the stacklight elements counting
     * upwards beginning from the base of the stacklight.
     */
    numberInList: UAProperty<any, any>;
    /**
     * signalOn
     * Indicates if the signal emitted by the stack
     * element is currently switched on or not.
     */
    signalOn?: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAStackElement extends UAObject, UAStackElement_Base {
}