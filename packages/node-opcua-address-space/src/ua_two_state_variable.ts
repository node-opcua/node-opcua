/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

import { BrowseDirection } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

import {
    BaseNode as BaseNodePublic,
    UATwoStateVariable  as UATwoStateVariablePublic,
    UAVariable as UAVariablePublic
} from "../source";

import { BaseNode } from "./base_node";
import { Reference } from "./reference";
import { UAVariable } from "./ua_variable";

const hasTrueSubState_ReferenceTypeNodeId = resolveNodeId("HasTrueSubState");
const hasFalseSubState_ReferenceTypeNodeId = resolveNodeId("HasFalseSubState");

// Release 1.03 12 OPC Unified Architecture, Part 9
// Two-state state machines
// Most states defined in this standard are simple – i.e. they are either TRUE or FALSE. The
// TwoStateVariableType is introduced specifically for this use case. More complex states are
// modelled by using a StateMachineType defined in Part 5.
// The TwoStateVariableType is derived from the StateVariableType.
//
// Attribute        Value
// BrowseName       TwoStateVariableType
// DataType         LocalizedText
// ValueRank        -1 (-1 = Scalar)
// IsAbstract       False
//
// Subtype of the StateVariableType defined in Part 5.
// Note that a Reference to this subtype is not shown in the definition of the StateVariableType
//
// References      NodeClass BrowseName              DataType      TypeDefinition Modelling Rule
// HasProperty     Variable  Id                      Boolean       PropertyType   Mandatory
// HasProperty     Variable  TransitionTime          UtcTime       PropertyType   Optional
// HasProperty     Variable  EffectiveTransitionTime UtcTime       PropertyType   Optional
// HasProperty     Variable  TrueState               LocalizedText PropertyType   Optional
// HasProperty     Variable  FalseState              LocalizedText PropertyType   Optional
// HasTrueSubState StateMachine or
//                 TwoStateVariableType
//                                                  <StateIdentifier> Defined in Clause 5.4.2 Optional
// HasFalseSubState StateMachine or
//                  TwoStateVariableType
//                                                  <StateIdentifier> Defined in Clause 5.4.3 Optional

function _updateTransitionTime(node: UATwoStateVariablePublic) {
    // TransitionTime specifies the time when the current state was entered.
    if (node.transitionTime) {
        node.transitionTime.setValueFromSource({ dataType: DataType.DateTime, value: (new Date()) });
    }
}

function _updateEffectiveTransitionTime(
  node: UATwoStateVariablePublic
) {
    if (node.effectiveTransitionTime) {
        // xx console.log("xxxx _updateEffectiveTransitionTime
        // because subStateNode ",subStateNode.browseName.toString());
        node.effectiveTransitionTime.setValueFromSource({
            dataType: DataType.DateTime,
            value: (new Date())
        });
    }
}

function _getEffectiveDisplayName(node: UATwoStateVariablePublic) {
    const dataValue = node.id.readValue();
    if (dataValue.statusCode !== StatusCodes.Good) {
        return dataValue;
    }
    assert(dataValue.value.dataType === DataType.Boolean);
    const boolValue = dataValue.value.value;

    const humanReadableString = _getHumanReadableString(node);

    let subStateNodes;
    if (boolValue) {
        subStateNodes = node.findReferencesExAsObject("HasTrueSubState", BrowseDirection.Forward);
    } else {
        subStateNodes = node.findReferencesExAsObject("HasFalseSubState", BrowseDirection.Forward);
    }
    const states = subStateNodes.forEach((n: any) => {
        // todo happen
    });

    return humanReadableString;
}

function _getHumanReadableString(node: UATwoStateVariablePublic) {

    let dataValue = node.id.readValue();
    if (dataValue.statusCode !== StatusCodes.Good) {
        return dataValue;
    }
    assert(dataValue.value.dataType === DataType.Boolean);
    const boolValue = dataValue.value.value;

    // The Value Attribute of a TwoStateVariable contains the current state as a human readable name.
    // The EnabledState for example, might contain the name “Enabled” when TRUE and “Disabled” when FALSE.

    let valueAsLocalizedText;

    if (boolValue) {
        const _trueState = ((node as any)._trueState) ? (node as any)._trueState : "TRUE";
        valueAsLocalizedText = { dataType: "LocalizedText", value: { text: _trueState } };

    } else {
        const _falseState = ((node as any)._falseState) ? (node as any)._falseState : "FALSE";
        valueAsLocalizedText = { dataType: "LocalizedText", value: { text: _falseState } };
    }
    dataValue = dataValue.clone();
    dataValue.value = new Variant(valueAsLocalizedText);
    return dataValue;
}

export function _install_TwoStateVariable_machinery(
  node: UATwoStateVariablePublic,
  options: any
): UATwoStateVariable {

    assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
    assert(node.minimumSamplingInterval === 0);
    assert(node.typeDefinitionObj.browseName.toString() === "TwoStateVariableType");
    assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
    assert(node.hasOwnProperty("valueRank") && (node.valueRank === -1 || node.valueRank === 0));

    options = options || {};
    // promote node into a UATwoStateVariable
    Object.setPrototypeOf(node, UATwoStateVariable.prototype);
    (node as UATwoStateVariable).initialize(options);
    return node as UATwoStateVariable;
}

export interface UATwoStateVariable {
    // components & properties
    readonly falseState?: UAVariablePublic;
    readonly trueState?: UAVariablePublic;
    readonly id: UAVariablePublic;
    readonly effectiveTransitionTime?: UAVariablePublic;
    readonly transitionTime?: UAVariablePublic;
    readonly effectiveDisplayName?: UAVariablePublic;
}
/***
 * @class UATwoStateVariable
 * @constructor
 * @extends UAVariable
 */
export class UATwoStateVariable extends UAVariable implements UATwoStateVariablePublic {

    public _trueState?: string;
    public _falseState?: string;

    public constructor(opts: any) {
        super(opts);
    }

    get isFalseSubStateOf() { return super.isFalseSubStateOf; }
    get isTrueSubStateOf()  { return super.isTrueSubStateOf;  }

    public initialize(options: any) {

        const node = this;

        if (options.trueState) {
            assert(options.falseState);
            assert(typeof (options.trueState) === "string");
            assert(typeof (options.falseState) === "string");
            node._trueState = options.trueState;
            node._falseState = options.falseState;

            if (node.falseState) {
                node.falseState.bindVariable({
                    get() {
                        return new Variant({
                            dataType: DataType.LocalizedText,
                            value: node._falseState
                        });
                    }
                }, true);

            }
            if (node.trueState) {
                node.trueState.bindVariable({
                    get() {
                        return new Variant({
                            dataType: DataType.LocalizedText,
                            value: node._trueState
                        });
                    }
                }, true);
            }
        }
        node.id.setValueFromSource({
            dataType: "Boolean",
            value: false
        }, StatusCodes.UncertainInitialValue);

        // handle isTrueSubStateOf
        if (options.isTrueSubStateOf) {
            node.addReference({
                isForward: false,
                nodeId: options.isTrueSubStateOf,
                referenceType: "HasTrueSubState"
            });
        }

        if (options.isFalseSubStateOf) {
            node.addReference({
                isForward: false,
                nodeId: options.isFalseSubStateOf,
                referenceType: "HasFalseSubState"
            });
        }

        if (node.effectiveTransitionTime) {
            // install "value_changed" event handler on SubState that are already defined
            const subStates = ([] as BaseNode[]).concat(node.getTrueSubStates(), node.getFalseSubStates());
            for (const subState of subStates) {
                subState.on("value_changed", () =>
                  _updateEffectiveTransitionTime(node));
            }
        }

        // it should be possible to define a trueState and falseState LocalizedText even if
        // the trueState or FalseState node is not exposed. Therefore we need to store their value
        // into dedicated variables.
        node.id.on("value_changed", () => {
            node._internal_set_dataValue(_getHumanReadableString(node));
        });
        node._internal_set_dataValue(_getHumanReadableString(node));

        // todo : also set the effectiveDisplayName if present

        // from spec Part 5
        // Release 1.03 OPC Unified Architecture, Part 5
        // EffectiveDisplayName contains a human readable name for the current state of the state
        // machine after taking the state of any SubStateMachines in account. There is no rule specified
        // for which state or sub-state should be used. It is up to the Server and will depend on the
        // semantics of the StateMachineType
        //
        // EffectiveDisplayName will be constructed by adding the EnableSdtate
        // and the State of the addTrue state
        if (node.effectiveDisplayName) {
            node.id.on("value_changed", () => {
                (node.effectiveDisplayName! as UAVariable)._internal_set_dataValue(_getEffectiveDisplayName(node));
            });
            (node.effectiveDisplayName! as UAVariable)._internal_set_dataValue(_getEffectiveDisplayName(node));
        }
    }

    /**
     * @method setValue
     * @param boolValue {Boolean}
     */
    public setValue(boolValue: boolean) {

        const node = this;
        assert(_.isBoolean(boolValue));
        const dataValue = node.id!.readValue();
        const oldValue = dataValue.value.value;
        if (dataValue.statusCode === StatusCodes.Good && boolValue === oldValue) {
            return; // nothing to do
        }
        //
        node.id.setValueFromSource(new Variant({ dataType: DataType.Boolean, value: boolValue }));
        _updateTransitionTime(node);
        _updateEffectiveTransitionTime(node);
    }

    /**
     * @method getValue
     * @return {Boolean}
     */
    public getValue(): boolean {
        const node = this;
        const dataValue = node.id!.readValue();
        assert(dataValue.statusCode === StatusCodes.Good);
        assert(dataValue.value.dataType === DataType.Boolean);
        return dataValue.value.value;
    }

    /**
     * @method getValueAsString
     * @return {string}
     */
    public getValueAsString(): string {
        const node = this;
        const dataValue = node.readValue();
        assert(dataValue.statusCode === StatusCodes.Good);
        assert(dataValue.value.dataType === DataType.LocalizedText);
        return dataValue.value.value.text.toString();
    }

    // TODO : shall we care about overloading the remove_backward_reference method ?
    // some TrueSubState and FalseSubState relationship may be added later
    // so we need a mechanism to keep adding the "value_changed" event handle on subStates that
    // will be defined later.
    // install change detection on sub State
    // this is useful to change the effective transitionTime
    // EffectiveTransitionTime specifies the time when the current state or one of its sub states was entered.
    // If, for example, a LevelAlarm is active and – while active – switches several times between High and
    // HighHigh, then the TransitionTime stays at the point in time where the Alarm became active whereas the
    // EffectiveTransitionTime changes with each shift of a sub state.
    protected _add_backward_reference(reference: Reference): void {

        const self = this;

        super._add_backward_reference(reference);

        if (reference.isForward &&
          (sameNodeId(reference.referenceType, hasTrueSubState_ReferenceTypeNodeId) ||
            sameNodeId(reference.referenceType, hasFalseSubState_ReferenceTypeNodeId))) {

            const addressSpace = self.addressSpace;
            // add event handle
            const subState = addressSpace.findNode(reference.nodeId) as UAVariable;
            subState.on("value_changed", _updateEffectiveTransitionTime.bind(null, self, subState));
        }
    }
}

// ;
// exports.UATwoStateVariable = UATwoStateVariable;
//
// exports.install = function(AddressSpace) {
//
//     assert(_.isUndefined(AddressSpace._install_TwoStateVariable_machinery ));
//     AddressSpace._install_TwoStateVariable_machinery = _install_TwoStateVariable_machinery;
//
//     /**
//      *
//      * @method addTwoStateVariable
//      *
//      * @param options
//      * @param options.browseName  {String}
//      * @param [options.description {String}]
//      * @param [options.modellingRule {String}]
//      * @param [options.minimumSamplingInterval {Number} =0]
//      * @param options.componentOf {Node|NodeId}
//      * @param options.propertyOf {Node|NodeId}
//      * @param options.trueState {String}
//      * @param options.falseState {String}
//      * @param [options.isTrueSubStateOf {NodeId}]
//      * @param [options.isFalseSubStateOf {NodeId}]
//      * @param [options.modellingRule]
//      * @return {UATwoStateVariable}
//      *
//      * Optionals can be EffectiveDisplayName, TransitionTime, EffectiveTransitionTime
//      */
//     AddressSpace.prototype.addTwoStateVariable   = function(options) {
//         return this._resolveRequestedNamespace(options).addTwoStateVariable(options);
//     };
// };
