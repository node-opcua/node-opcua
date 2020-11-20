/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";

import { BrowseDirection, coerceLocalizedText, LocalizedText } from "node-opcua-data-model";
import { DataValue, DataValueT } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import { sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { Variant, VariantT } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

// public interfaces
import {
    AddTwoStateVariableOptions,
    BaseNode as BaseNodePublic,
    Namespace,
    UAVariable as UAVariablePublic,
    UAVariableT
} from "../../source";
import { UATwoStateVariable as UATwoStateVariablePublic } from "../../source/interfaces/state_machine/ua_two_state_variable";
import {
    UAStateVariable as UAStateVariablePublic,
    _UAStateVariable
} from "../../source/interfaces/state_machine/ua_state_variable";
// private types
import { BaseNode } from "../base_node";
import { Reference } from "../reference";
import { UAVariable } from "../ua_variable";
import { VariableIds, VariableTypeIds } from "node-opcua-constants";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";

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

function _updateTransitionTime(node: UATwoStateVariable) {
    // TransitionTime specifies the time when the current state was entered.
    if (node.transitionTime) {
        node.transitionTime.setValueFromSource({ dataType: DataType.DateTime, value: new Date() });
    }
}

function _updateEffectiveTransitionTime(node: UATwoStateVariable) {
    if (node.effectiveTransitionTime) {
        // xx console.log("xxxx _updateEffectiveTransitionTime
        // because subStateNode ",subStateNode.browseName.toString());
        node.effectiveTransitionTime.setValueFromSource({
            dataType: DataType.DateTime,
            value: new Date()
        });
    }
}

function _getEffectiveDisplayName(node: UATwoStateVariable): DataValueT<LocalizedText, DataType.LocalizedText> {
    const humanReadableString = _getHumanReadableString(node);
    if (humanReadableString.statusCode !== StatusCodes.Good) {
        return humanReadableString;
    }
    const boolValue = node.getValue();

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

function _getHumanReadableString(node: UATwoStateVariable): DataValueT<LocalizedText, DataType.LocalizedText> {
    let dataValue = node.id.readValue();

    if (dataValue.statusCode !== StatusCodes.Good) {
        const _c = dataValue.clone() as DataValueT<LocalizedText, DataType.LocalizedText>;
        _c.value = new Variant({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText("")!
        }) as VariantT<LocalizedText, DataType.LocalizedText>;

        return _c;
    }
    assert(dataValue.value.dataType === DataType.Boolean);
    const boolValue = dataValue.value.value;

    // The Value Attribute of a TwoStateVariable contains the current state as a human readable name.
    // The EnabledState for example, might contain the name “Enabled” when TRUE and “Disabled” when FALSE.

    const dataValue2 = dataValue.clone();
    dataValue2.value = new Variant({
        dataType: DataType.LocalizedText,
        value: boolValue ? node.getTrueState() : node.getFalseState()
    });
    return dataValue2 as DataValueT<LocalizedText, DataType.LocalizedText>;
}

export function _install_TwoStateVariable_machinery(node: UAVariablePublic, options: any): UATwoStateVariable {
    assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
    assert(node.minimumSamplingInterval === 0);
    assert(node.typeDefinitionObj.browseName.toString() === "TwoStateVariableType");
    assert(node.dataTypeObj.browseName.toString() === "LocalizedText");
    assert(node.hasOwnProperty("valueRank") && (node.valueRank === -1 || node.valueRank === 0));

    options = options || {};
    // promote node into a UATwoStateVariable
    const _node = promoteToTwoStateVariable(node);
    (node as UATwoStateVariable).initialize(options);
    return node as UATwoStateVariable;
}

export function promoteToTwoStateVariable(node: UAVariablePublic): UATwoStateVariablePublic {
    if (node instanceof UATwoStateVariable) {
        return node as UATwoStateVariablePublic;
    }
    // istanbul ignore next
    if (!(node instanceof UAVariable)) {
        throw new Error("Trying to promote a invalid object");
    }
    Object.setPrototypeOf(node, UATwoStateVariable.prototype);
    return (node as unknown) as UATwoStateVariablePublic;
}
registerNodePromoter(VariableTypeIds.TwoStateVariableType, promoteToTwoStateVariable);

//
export interface UATwoStateVariable {
    readonly id: UAVariableT<boolean, DataType.Boolean>;

    readonly falseState?: UAVariableT<LocalizedText, DataType.LocalizedText>;
    readonly trueState?: UAVariableT<LocalizedText, DataType.LocalizedText>;
    readonly effectiveTransitionTime?: UAVariableT<Date, DataType.DateTime>; // UtcTime
    readonly transitionTime?: UAVariableT<Date, DataType.DateTime>;
    readonly effectiveDisplayName?: UAVariableT<LocalizedText, DataType.LocalizedText>;

    // references
}
/***
 * @class UATwoStateVariable
 * @constructor
 * @extends UAVariable
 */
export class UATwoStateVariable extends UAVariable implements UAStateVariablePublic {
    private _trueState?: string;
    private _falseState?: string;

    public constructor(opts: any) {
        super(opts);
    }

    get isFalseSubStateOf() {
        return super.isFalseSubStateOf as UAStateVariablePublic;
    }
    get isTrueSubStateOf() {
        return super.isTrueSubStateOf as UAStateVariablePublic;
    }

    public initialize(options: any) {
        const node = this;

        if (options.trueState) {
            assert(options.falseState);
            assert(typeof options.trueState === "string");
            assert(typeof options.falseState === "string");

            if (node.falseState) {
                node.falseState.setValueFromSource({
                    dataType: DataType.LocalizedText,
                    value: coerceLocalizedText(options.falseState)
                });
            } else {
                node._trueState = options.trueState;
            }
            if (node.trueState) {
                node.trueState.setValueFromSource({
                    dataType: DataType.LocalizedText,
                    value: coerceLocalizedText(options.trueState)
                });
            } else {
                node._falseState = options.falseState;
            }
        }

        node.id.setValueFromSource(
            {
                dataType: "Boolean",
                value: false
            },
            StatusCodes.UncertainInitialValue
        );

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

        this._postInitialize();
    }

    public _postInitialize() {
        const node = this;
        if (node.effectiveTransitionTime) {
            // install "value_changed" event handler on SubState that are already defined
            const subStates = ([] as UAStateVariablePublic[]).concat(node.getTrueSubStates(), node.getFalseSubStates());
            for (const subState of subStates) {
                subState.on("value_changed", () => _updateEffectiveTransitionTime(node));
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
        // EffectiveDisplayName will be constructed by adding the EnableState
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
        assert(typeof boolValue === "boolean");
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
    public getTrueState(): LocalizedText {
        return this.trueState ? this.trueState.readValue().value.value : coerceLocalizedText(this._trueState || "TRUE")!;
    }
    public getFalseState(): LocalizedText {
        return this.falseState ? this.falseState.readValue().value.value : coerceLocalizedText(this._falseState || "FALSE")!;
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

        if (
            reference.isForward &&
            (sameNodeId(reference.referenceType, hasTrueSubState_ReferenceTypeNodeId) ||
                sameNodeId(reference.referenceType, hasFalseSubState_ReferenceTypeNodeId))
        ) {
            const addressSpace = self.addressSpace;
            // add event handle
            const subState = addressSpace.findNode(reference.nodeId) as UAVariable;
            subState.on("value_changed", _updateEffectiveTransitionTime.bind(null, self, subState));
        }
    }
}

export function _addTwoStateVariable(namespace: Namespace, options: AddTwoStateVariableOptions): UATwoStateVariablePublic {
    const addressSpace = namespace.addressSpace;

    const twoStateVariableType = addressSpace.findVariableType("TwoStateVariableType");
    if (!twoStateVariableType) {
        throw new Error("cannot find TwoStateVariableType");
    }

    options.optionals = options.optionals || [];
    if (options.trueState) {
        options.optionals.push("TrueState");
    }
    if (options.falseState) {
        options.optionals.push("FalseState");
    }

    // we want event based changes...
    options.minimumSamplingInterval = 0;

    const node = twoStateVariableType.instantiate({
        browseName: options.browseName,

        nodeId: options.nodeId,

        description: options.description,

        componentOf: options.componentOf,
        organizedBy: options.organizedBy,

        modellingRule: options.modellingRule,

        dataType: resolveNodeId(DataType.LocalizedText),

        minimumSamplingInterval: options.minimumSamplingInterval,

        optionals: options.optionals
    });

    const _node = _install_TwoStateVariable_machinery(node, options);
    return _node as UATwoStateVariablePublic;
}
