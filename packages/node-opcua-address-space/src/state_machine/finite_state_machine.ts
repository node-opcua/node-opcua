/**
 * @module node-opcua-address-space
 */
import chalk from "chalk";
import { UAState, UAStateVariable, UATransition, UATransition_Base, UATransitionVariable } from "node-opcua-nodeset-ua";
import { assert } from "node-opcua-assert";
import { ObjectTypeIds } from "node-opcua-constants";
import {
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    LocalizedText,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { UAString } from "node-opcua-basic-types";
import { BaseNode, UAMethod, UAObject, UAObjectType, UAProperty, UAVariable, UAVariableT } from "node-opcua-address-space-base";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";

import {
    UAStateMachineEx,
    TransitionSelector,
    UAStateMachineTypeHelper
} from "../../source/interfaces/state_machine/ua_state_machine_type";
import { UAObjectImpl } from "../ua_object_impl";
import { UATransitionEx } from "../../source/interfaces/state_machine/ua_transition_ex";
import { BaseNodeImpl } from "../base_node_impl";
import { UAObjectTypeImpl } from "../ua_object_type_impl";

const warningLog = make_warningLog(__filename);

const doDebug = false;
const debugLog = make_debugLog(__filename);

export declare interface UATransitionImpl extends UATransition, UATransitionEx {}
export class UATransitionImpl implements UATransition, UATransitionEx {}

function getComponentOfType(typeDef: UAObjectType, typedefinition: UAObjectType): UAObject[] {
    const get = (typeDef: UAObjectType) =>
        typeDef.getComponents().filter((cc) => {
            const c = cc as UAObject | UAVariable | UAMethod;
            if (c.nodeClass !== NodeClass.Object) return false;
            if (!c.typeDefinitionObj || c.typeDefinitionObj.nodeClass !== NodeClass.ObjectType) {
                return false;
            }
            return c.typeDefinitionObj.isSubtypeOf(typedefinition);
        });

    let components_parts: BaseNode[] = get(typeDef);

    while (components_parts.length === 0 && typeDef.subtypeOfObj) {
        // there is no element of that type available in the top level
        typeDef = typeDef.subtypeOfObj;
        components_parts = get(typeDef);
    }
    return components_parts as UAObject[];
}

export interface UAStateMachineImpl {
    currentState: UAStateVariable<LocalizedText>;
    lastTransition?: UATransitionVariable<LocalizedText>;

    // Extra
    _currentStateNode: UAState | null;
}

const defaultPredicate = (transitions: UATransition[], fromState: UAState, toState: UAState) => {
    if (transitions.length === 0) {
        return null;
    }
    if (transitions.length === 1) {
        return transitions[0];
    }
    warningLog(" FromState = ", fromState.browseName.toString());
    warningLog(" ToState   = ", toState.browseName.toString());
    for (const transition of transitions) {
        warningLog("  possible transition : ", transition.browseName.toString(), " ", transition.nodeId.toString());
    }
    warningLog(
        "warning: a duplicated FromState Reference to the same target has been found.\nPlease check your model or provide a predicate method to select which one to use"
    );
    warningLog("fromStateNode: ", fromState.toString());
    return transitions[0];
};

export function getFiniteStateMachineTypeStates(uaFiniteStateMachineType: UAObjectType): UAState[] {
    const addressSpace = uaFiniteStateMachineType.addressSpace;

    const initialStateType = addressSpace.findObjectType("InitialStateType");
    // istanbul ignore next
    if (!initialStateType) {
        throw new Error("cannot find InitialStateType");
    }

    const stateType = addressSpace.findObjectType("StateType");
    // istanbul ignore next
    if (!stateType) {
        throw new Error("cannot find StateType");
    }

    assert(initialStateType.isSubtypeOf(stateType));

    const comp = getComponentOfType(uaFiniteStateMachineType, stateType);

    return comp as UAState[];
}
export function getFiniteStateMachineTypeTransitions(uaFiniteStateMachineType: UAObjectType): UATransitionEx[] {
    const addressSpace = uaFiniteStateMachineType.addressSpace;

    const transitionType = addressSpace.findObjectType("TransitionType");
    // istanbul ignore next
    if (!transitionType) {
        throw new Error("cannot find TransitionType");
    }
    const comp = getComponentOfType(uaFiniteStateMachineType, transitionType);
    return comp as UATransitionEx[];
}

export function getFiniteStateMachineTypeStateByName(uaFiniteStateMachineType: UAObjectType, stateName: string): UAState | null {
    let states = getFiniteStateMachineTypeStates(uaFiniteStateMachineType);
    states = states.filter((s: any) => {
        return s.browseName.name === stateName;
    });
    assert(states.length <= 1);
    return states.length === 1 ? (states[0] as any as UAState) : null;
}

/*
 *
 * @class StateMachine
 *
 */
export class UAStateMachineImpl extends UAObjectImpl implements UAStateMachineEx {
    public getStates(): UAState[] {
        const typeDef = this.typeDefinitionObj;
        return getFiniteStateMachineTypeStates(typeDef);
    }

    public get states(): UAState[] {
        return this.getStates();
    }

    /**
     * @param name  the name of the state to get
     * @return the state with the given name
     */
    public getStateByName(name: string): UAState | null {
        return getFiniteStateMachineTypeStateByName(this.typeDefinitionObj, name);
    }

    public getTransitions(): UATransitionEx[] {
        const typeDef = this.typeDefinitionObj;
        return getFiniteStateMachineTypeTransitions(typeDef);
    }

    public get transitions(): UATransitionEx[] {
        return this.getTransitions();
    }

    /**
     * return the node InitialStateType
     * @property initialState
     */
    get initialState(): UAState | null {
        const addressSpace = this.addressSpace;

        const initialStateType = addressSpace.findObjectType("InitialStateType")!;
        const typeDef = this.typeDefinitionObj;

        const comp = getComponentOfType(typeDef, initialStateType);
        // istanbul ignore next
        if (comp.length > 1) {
            throw new Error(" More than 1 initial state in stateMachine");
        }
        return comp.length === 0 ? null : (comp[0] as UAState);
    }

    /**
     *
     * @param node
     * @private
     */
    public _coerceNode(node: UAState | BaseNode | null | string | NodeId): BaseNode | null {
        if (node instanceof BaseNodeImpl) {
            return node;
        } else if (node instanceof NodeId) {
            const addressSpace = this.addressSpace;
            return addressSpace.findNode(node) as BaseNode;
        } else if (typeof node === "string") {
            return this.getStateByName(node) as any as BaseNode;
        }
        return null;
    }

    /**
     */
    public isValidTransition(toStateNode: UAState | string, predicate?: TransitionSelector): boolean {
        // is it legal to go from state currentState to toStateNode;
        if (!this.currentStateNode) {
            return true;
        }
        const n = this.currentState.readValue();

        // to be executed there must be a transition from currentState to toState
        const transition = this.findTransitionNode(this.currentStateNode, toStateNode, predicate);
        if (!transition) {
            // istanbul ignore next
            if (doDebug) {
                debugLog(" No transition from ", this.currentStateNode.browseName.toString(), " to ", toStateNode.toString());
            }
            return false;
        }
        return true;
    }

    /**
     */
    public findTransitionNode(
        fromStateNode: NodeId | UAState | string | null,
        toStateNode: NodeId | UAState | string | null,
        predicate?: TransitionSelector
    ): UATransitionEx | null {
        const addressSpace = this.addressSpace;

        const _fromStateNode = this._coerceNode(fromStateNode) as UAObject;
        if (!_fromStateNode) {
            return null;
        }

        const _toStateNode = this._coerceNode(toStateNode) as UAObject;
        if (!_toStateNode) {
            return null;
        }

        // istanbul ignore next
        if (_fromStateNode.nodeClass !== NodeClass.Object) {
            throw new Error("Internal Error");
        }
        // istanbul ignore next
        if (_toStateNode && _toStateNode.nodeClass !== NodeClass.Object) {
            throw new Error("Internal Error");
        }

        const stateType = addressSpace.findObjectType("StateType");
        
        // istanbul ignore next
        if (!stateType) {
            throw new Error("Cannot find StateType");
        }
        assert((_fromStateNode.typeDefinitionObj as any).isSubtypeOf(stateType));
        assert((_toStateNode.typeDefinitionObj as any).isSubtypeOf(stateType));

        let transitions = _fromStateNode.findReferencesAsObject("FromState", false) as UATransitionImpl[];

        transitions = transitions.filter((transition: any) => {
            assert(transition.toStateNode.nodeClass === NodeClass.Object);
            return transition.toStateNode === _toStateNode;
        });
        if (transitions.length === 0) {
            // cannot find a transition from fromState to toState
            return null;
        }
        // istanbul ignore next
        if (transitions.length > 1) {
            const selectedTransition = (predicate || defaultPredicate)(
                transitions,
                _fromStateNode as unknown as UAState,
                _toStateNode as unknown as UAState
            );
            return selectedTransition as UATransitionEx;
        }
        return transitions[0];
    }

    public get currentStateNode(): UAState | null {
        return this._currentStateNode;
    }

    /**
     * @property currentStateNode
     * @type BaseNode
     */
    public set currentStateNode(value: UAState | null) {
        this._currentStateNode = value;
    }

    /**
     */
    public getCurrentState(): string | null {
        // xx this.currentState.readValue().value.value.text
        // xx this.shelvingState.currentStateNode.browseName.toString()
        if (!this.currentStateNode) {
            return null;
        }
        return this.currentStateNode.browseName.toString();
    }

    /**
     */
    public setState(toStateNode: string | UAState | null, predicate?: TransitionSelector): void {
        if (!toStateNode) {
            this.currentStateNode = null;
            this.currentState.setValueFromSource({ dataType: DataType.LocalizedText, value: null }, StatusCodes.BadStateNotActive);
            return;
        }

        if (typeof toStateNode === "string") {
            const state = this.getStateByName(toStateNode);
            // istanbul ignore next
            if (!state) {
                throw new Error("Cannot find state with name " + toStateNode);
            }
            toStateNode = state;
        }
        const fromStateNode = this.currentStateNode;

        toStateNode = this._coerceNode(toStateNode) as any as UAState;
        assert(toStateNode.nodeClass === NodeClass.Object);

        this.currentState.setValueFromSource(
            {
                dataType: DataType.LocalizedText,
                value: coerceLocalizedText(toStateNode.displayName[0] || toStateNode.browseName.name!)
            },
            StatusCodes.Good
        );

        this.currentStateNode = toStateNode;

        const applyCurrentStateOptionalProps = () => {
            const uaId = this.currentState.getPropertyByName("Id")! as UAVariable;
            if (uaId) {
                uaId.setValueFromSource({
                    dataType: DataType.NodeId,
                    value: this.currentStateNode ? this.currentStateNode.nodeId : NodeId.nullNodeId
                });
            }

            const uaName = this.currentState.getPropertyByName("Name")! as UAVariable;
            if (uaName) {
                uaName.setValueFromSource({
                    dataType: DataType.QualifiedName,
                    value: this.currentStateNode ? this.currentStateNode.browseName : coerceQualifiedName("")
                });
            }

            const uaNumber = this.currentState.getPropertyByName("Number")! as UAVariable;
            if (uaNumber) {
                if (!this.currentStateNode) {
                    const n = uaNumber.setValueFromSource({
                        dataType: DataType.UInt32,
                        value: 0 // may be wrong !
                    });
                } else {
                    const n = uaNumber.setValueFromSource({
                        dataType: DataType.UInt32,
                        value: this.currentStateNode.stateNumber.readValue().value.value
                    });
                }
            }

            const uaEffectiveDisplayName = this.currentState.getPropertyByName("EffectiveDisplayName")! as UAVariable;
            if (uaEffectiveDisplayName) {
                uaEffectiveDisplayName.setValueFromSource({
                    dataType: DataType.LocalizedText,
                    value: coerceLocalizedText(
                        this.currentStateNode ? this.currentStateNode.displayName[0] || this.currentStateNode.browseName.name : ""
                    )
                });
            }
        };
        applyCurrentStateOptionalProps();

        const transitionTime = new Date();
        const applyTransitionOptionalPropsPhase1 = () => {
            //                                                  +-----------------------------+
            //             +--------------------------------|>|>| MainStateMachineType        |
            //             |                                    +-----------------------------+
            //             |                                                 |
            //             |                                                 |    +--------+
            // +------------------+                                          +--->| State1 |
            // | MainStateMachine |                                          |    +--------+
            // +------------------+                                          |
            //       |                                                       |    +--------+
            //       |       +----------------+                              +--->| State2 |   --- HasSubStateMachine --+
            //       +---||->| SubStateMachine|                              |    +--------+                            |
            //               +----------------+                              |                                          |
            //                      |                                        |    +-----------------+                   |
            //                                                               +--->| SubStateMachine |<------------------+
            //                                                                    +-----------------+
            //
            // * `this` is potentially a subState machine
            // *  get mainState = parent of `this`
            // *  is mainState.typeDefinition is not StateMachineType -> exit
            // *  find subMachine in mainState.typeDefinition (or any subtype of it) that has the same browse name as this.browseName
            const ms = this.findReferencesExAsObject("Aggregates", BrowseDirection.Inverse)[0] as
                | UAStateMachineEx
                | undefined
                | null;
            if (!ms) return;
            if (ms.nodeClass !== NodeClass.Object) return;
            const stateMachineType = this.addressSpace.findObjectType("StateMachineType")!;
            if (!ms.typeDefinitionObj.isSubtypeOf(stateMachineType)) return;

            const find = (node: UAObjectType, browseName: QualifiedName): UAObject | UAVariable | null => {
                const r = node
                    .getAggregates()
                    .filter((x) => x.browseName.name! === browseName.name && x.namespaceIndex === browseName.namespaceIndex);
                if (r.length === 0) {
                    // look in subType
                    const subType = node.subtypeOfObj;
                    if (subType) {
                        return find(subType, browseName);
                    }
                    return null;
                } else {
                    const retVal = r[0];

                    // istanbul ignore next
                    if (retVal.nodeClass !== NodeClass.Variable && retVal.nodeClass !== NodeClass.Object) {
                        throw new Error("find: expecting only object and variable here");
                    }
                    return retVal as UAObject | UAVariable;
                }
            };
            const stateMachineInType = find(ms.typeDefinitionObj, this.browseName);
            if (!stateMachineInType) return;
            const mainState = stateMachineInType.findReferencesAsObject("HasSubStateMachine", false)[0] as UAVariable;

            if (mainState) {
                if (!ms.currentStateNode || !sameNodeId(mainState.nodeId, ms.currentStateNode.nodeId)) {
                    return;
                }

                // also update uaLastTransition.EffectiveTransitionTime
                const uaLastTransitionMain = ms.getComponentByName("LastTransition") as UAVariable;
                if (uaLastTransitionMain) {
                    const uaEffectiveTransitionTimeMain = uaLastTransitionMain.getPropertyByName(
                        "EffectiveTransitionTime"
                    )! as UAVariable;
                    if (uaEffectiveTransitionTimeMain) {
                        uaEffectiveTransitionTimeMain.setValueFromSource({
                            dataType: DataType.DateTime,
                            value: transitionTime
                        });
                    }
                }
            }
        };
        applyTransitionOptionalPropsPhase1();

        const transitionNode = this.findTransitionNode(fromStateNode, toStateNode, predicate) as UATransitionImpl;
        if (transitionNode) {
            const applyLastTransitionOptionalProps = () => {
                const uaLastTransition = this.getComponentByName("LastTransition") as UAVariable;
                if (uaLastTransition) {
                    uaLastTransition.setValueFromSource(
                        {
                            dataType: DataType.LocalizedText,
                            value: transitionNode.displayName[0] || transitionNode.browseName.name!
                        },
                        StatusCodes.Good,
                        transitionTime
                    );

                    const uaId = uaLastTransition.getPropertyByName("Id")! as UAVariable;
                    if (uaId) {
                        uaId.setValueFromSource({
                            dataType: DataType.NodeId,
                            value: transitionNode.nodeId
                        });
                    }

                    const uaLastTransitionTime = uaLastTransition.getPropertyByName("TransitionTime")! as UAVariable;
                    if (uaLastTransitionTime) {
                        uaLastTransitionTime.setValueFromSource({
                            dataType: DataType.DateTime,
                            value: transitionTime
                        });
                    }
                    /**
                     * EffectiveTransitionTime specifies the time when the current state or one of its sub-states was entered.
                     * If, for example, a StateA is active and – while active – switches several times between its sub-states
                     * SubA and SubB, then the TransitionTime stays at the point in time where StateA became active whereas the *
                     * EffectiveTransitionTime changes with each change of a sub-state.
                     */
                    const uaEffectiveTransitionTime = uaLastTransition.getPropertyByName("EffectiveTransitionTime")! as UAVariable;
                    if (uaEffectiveTransitionTime) {
                        uaEffectiveTransitionTime.setValueFromSource({
                            dataType: DataType.DateTime,
                            value: transitionTime
                        });
                    }
                    //
                    const uaName = uaLastTransition.getPropertyByName("Name")! as UAVariable;
                    if (uaName) {
                        uaName.setValueFromSource({
                            dataType: DataType.QualifiedName,
                            value: transitionNode.browseName
                        });
                    }
                    const uaNumber = uaLastTransition.getPropertyByName("Number")! as UAVariable;
                    if (uaNumber) {
                        uaNumber.setValueFromSource({
                            dataType: DataType.UInt32,
                            value: transitionNode.transitionNumber.readValue().value.value
                        });
                    }
                }
            };
            applyLastTransitionOptionalProps();
            // The inherited Property SourceNode shall be filled with the NodeId of the StateMachine instance where the
            // Transition occurs. If the Transition occurs in a SubStateMachine, then the NodeId of the SubStateMachine
            // has to be used. If the Transition occurs between a StateMachine and a SubStateMachine, then the NodeId of
            // the StateMachine has to be used, independent of the direction of the Transition.
            // Transition identifies the Transition that triggered the Event.
            // FromState identifies the State before the Transition.
            // ToState identifies the State after the Transition.
            this.raiseEvent("TransitionEventType", {
                // Base EventType
                // xx nodeId:      this.nodeId,
                // TransitionEventType
                // TransitionVariableType
                transition: {
                    dataType: "LocalizedText",
                    value: (transitionNode as BaseNode).displayName[0]
                },

                "transition.id": transitionNode.transitionNumber.readValue().value,

                fromState: {
                    dataType: "LocalizedText",
                    value: fromStateNode ? fromStateNode.displayName[0] : ""
                }, // StateVariableType

                "fromState.id": fromStateNode
                    ? fromStateNode.stateNumber.readValue().value
                    : {
                          dataType: "Null"
                      },

                toState: {
                    dataType: "LocalizedText",
                    value: toStateNode.displayName[0]
                }, // StateVariableType

                "toState.id": toStateNode.stateNumber.readValue().value
            });
        } else {
            if (fromStateNode && fromStateNode !== toStateNode) {
                // istanbul ignore next
                if (doDebug) {
                    const f = fromStateNode.browseName.toString();
                    const t = toStateNode.browseName.toString();
                    warningLog(chalk.red("Warning"), " cannot raise event :  transition " + f + " to " + t + " is missing");
                }
            }
        }

        // also update executable flags on methods
        for (const method of this.getMethods()) {
            (method as any)._notifyAttributeChange(AttributeIds.Executable);
        }
    }

    /**
     * @internal
     * @private|
     */
    public _post_initialize(): void {
        const addressSpace = this.addressSpace;
        const finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType");
       
        // istanbul ignore next
        if (!finiteStateMachineType) {
            throw new Error("cannot find FiniteStateMachineType");
        }

        // xx assert(this.typeDefinitionObj && !this.subtypeOfObj);
        // xx assert(!this.typeDefinitionObj || this.typeDefinitionObj.isSubtypeOf(finiteStateMachineType));
        // get current Status

        const d = this.currentState.readValue();

        if (d.statusCode.isNotGood()) {
            this.setState(null);
        } else {
            const txt =
                d.value && d.value.value ? (d.value.value.text ? d.value.value.text.toString() : d.value.value.toString()) : "";
            this.currentStateNode = this.getStateByName(txt);
        }

        // Install AvailableStatesVariable if available
        const uaAvailableStates = this.getComponentByName("AvailableStates", 0) as UAVariable;
        if (uaAvailableStates) {
            uaAvailableStates.bindVariable(
                {
                    get: () => {
                        return new Variant({
                            arrayType: VariantArrayType.Array,
                            dataType: DataType.NodeId,
                            value: this.getStates().map((state) => state.nodeId)
                        });
                    }
                },
                true
            );
        }
        const uaAvailableTransitions = this.getComponentByName("AvailableTransitions", 0) as UAVariable;
        if (uaAvailableTransitions) {
            uaAvailableTransitions.bindVariable(
                {
                    get: () => {
                        return new Variant({
                            arrayType: VariantArrayType.Array,
                            dataType: DataType.NodeId,
                            value: this.getTransitions().map((state) => state.nodeId)
                        });
                    }
                },
                true
            );
        }
    }
}

export function promoteToStateMachine(node: UAObject): UAStateMachineEx {
    if (node instanceof UAStateMachineImpl) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UAStateMachineImpl.prototype);
    assert(node instanceof UAStateMachineImpl, "should now  be a State Machine");
    const _node = node as unknown as UAStateMachineImpl;
    _node._post_initialize();
    return _node;
}
registerNodePromoter(ObjectTypeIds.FiniteStateMachineType, promoteToStateMachine);

export class UAStateMachineTypeImpl extends UAObjectTypeImpl implements UAStateMachineTypeHelper {
    getStateByName(name: string): UAState | null {
        return getFiniteStateMachineTypeStateByName(this, name);
    }
    getStates(): UAState[] {
        return getFiniteStateMachineTypeStates(this);
    }
    getTransitions(): UATransitionEx[] {
        return getFiniteStateMachineTypeTransitions(this);
    }
    _post_initialize(): void {
        /** */
    }
}
export function promoteToStateMachineType(node: UAObject): UAStateMachineTypeHelper {
    if (node instanceof UAStateMachineTypeImpl) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UAStateMachineTypeImpl.prototype);
    assert(node instanceof UAStateMachineTypeImpl, "should now  be a State Machine");
    const _node = node as unknown as UAStateMachineTypeImpl;
    _node._post_initialize();
    return _node;
}
