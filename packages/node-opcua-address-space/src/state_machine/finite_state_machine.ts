/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";
import { UAState, UAStateVariable, UATransition, UATransition_Base, UATransitionVariable } from "node-opcua-nodeset-ua";
import { assert } from "node-opcua-assert";
import { ObjectTypeIds } from "node-opcua-constants";
import { coerceLocalizedText, LocalizedText, NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { BaseNode, UAMethod, UAObject, UAObjectType, UAVariable } from "node-opcua-address-space-base";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";

import { UAStateMachineEx, TransitionSelector } from "../../source/interfaces/state_machine/ua_state_machine_type";
import { UAObjectImpl } from "../ua_object_impl";
import { UATransitionEx } from "../../source/interfaces/state_machine/ua_transition_ex";
import { BaseNodeImpl } from "../base_node_impl";

const doDebug = false;

export declare interface UATransitionImpl extends UATransition, UATransitionEx {}
export class UATransitionImpl implements UATransition, UATransitionEx {}

function getComponentFromTypeAndSubtype(typeDef: UAObjectType): UAObject[] {
    const components_parts: BaseNode[][] = [];
    components_parts.push(typeDef.getComponents());
    while (typeDef.subtypeOfObj) {
        typeDef = typeDef.subtypeOfObj;
        components_parts.push(typeDef.getComponents());
    }
    return Array.prototype.concat.apply([], components_parts).filter((x: BaseNode) => x.nodeClass === NodeClass.Object);
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
    // tslint:disable-next-line: no-console
    console.log(" FromState = ", fromState.browseName.toString());
    // tslint:disable-next-line: no-console
    console.log(" ToState   = ", toState.browseName.toString());
    for (const transition of transitions) {
        // tslint:disable-next-line: no-console
        console.log("  possible transition : ", transition.browseName.toString(), " ", transition.nodeId.toString());
    }
    // tslint:disable-next-line: no-console
    console.log(
        "warning: a duplicated FromState Reference to the same target has been found.\nPlease check your model or provide a predicate method to select which one to use"
    );
    // tslint:disable-next-line: no-console
    console.log("fromStateNode: ", fromState.toString());
    return transitions[0];
};

/*
 *
 * @class StateMachine
 * @constructor
 * @extends UAObject
 *
 *
 */
export class UAStateMachineImpl extends UAObjectImpl implements UAStateMachineEx {
    public getStates(): UAState[] {
        const addressSpace = this.addressSpace;

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

        assert(initialStateType.isSupertypeOf(stateType));

        const typeDef = this.typeDefinitionObj;

        let comp = getComponentFromTypeAndSubtype(typeDef);

        comp = comp.filter((c) => {
            if (!c.typeDefinitionObj || c.typeDefinitionObj.nodeClass !== NodeClass.ObjectType) {
                return false;
            }
            return c.typeDefinitionObj.isSupertypeOf(stateType);
        });

        return comp as UAState[];
    }

    public get states(): UAState[] {
        return this.getStates();
    }

    /**
     * @method getStateByName
     * @param name  the name of the state to get
     * @return the state with the given name
     */
    public getStateByName(name: string): UAState | null {
        let states = this.getStates();
        states = states.filter((s: any) => {
            return s.browseName.name === name;
        });
        assert(states.length <= 1);
        return states.length === 1 ? (states[0] as any as UAState) : null;
    }

    public getTransitions(): UATransitionEx[] {
        const addressSpace = this.addressSpace;

        const transitionType = addressSpace.findObjectType("TransitionType");
        // istanbul ignore next
        if (!transitionType) {
            throw new Error("cannot find TransitionType");
        }
        const typeDef = this.typeDefinitionObj;

        let comp = getComponentFromTypeAndSubtype(typeDef);

        comp = comp.filter((c) => {
            if (!c.typeDefinitionObj || c.typeDefinitionObj.nodeClass !== NodeClass.ObjectType) {
                return false;
            }
            return c.typeDefinitionObj.isSupertypeOf(transitionType);
        });

        return comp as UATransitionEx[];
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

        const initialStateType = addressSpace.findObjectType("InitialStateType");
        const typeDef = this.typeDefinitionObj;

        let comp = getComponentFromTypeAndSubtype(typeDef);

        comp = comp.filter((c: any) => c.typeDefinitionObj === initialStateType);

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
        if (node === null) {
            return null;
        }
        const addressSpace = this.addressSpace;
        if (node instanceof BaseNodeImpl) {
            return node;
        } else if (node instanceof NodeId) {
            return addressSpace.findNode(node) as BaseNode;
        } else if (typeof node === "string") {
            return this.getStateByName(node) as any as BaseNode;
        }
        return null;
    }

    /**
     * @method isValidTransition
     * @param toStateNode
     * @return {boolean}
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
                // tslint:disable-next-line: no-console
                console.log(" No transition from ", this.currentStateNode.browseName.toString(), " to ", toStateNode.toString());
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

        if (_fromStateNode.nodeClass !== NodeClass.Object) {
            throw new Error("Internal Error");
        }
        if (_toStateNode && _toStateNode.nodeClass !== NodeClass.Object) {
            throw new Error("Internal Error");
        }

        const stateType = addressSpace.findObjectType("StateType");
        if (!stateType) {
            throw new Error("Cannot find StateType");
        }
        assert((_fromStateNode.typeDefinitionObj as any).isSupertypeOf(stateType));
        assert((_toStateNode.typeDefinitionObj as any).isSupertypeOf(stateType));

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
     * @method setState
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
            assert(state.browseName.name!.toString() === toStateNode);
            toStateNode = state;
        }
        const fromStateNode = this.currentStateNode;

        toStateNode = this._coerceNode(toStateNode) as any as UAState;
        assert(toStateNode.nodeClass === NodeClass.Object);

        this.currentState.setValueFromSource(
            {
                dataType: DataType.LocalizedText,
                value: coerceLocalizedText(toStateNode.browseName.toString())
            },
            StatusCodes.Good
        );

        this.currentStateNode = toStateNode;

        const transitionNode = this.findTransitionNode(fromStateNode, toStateNode, predicate) as UATransitionImpl;

        if (transitionNode) {
            // xx console.log("transitionNode ",transitionNode.toString());
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
                    // tslint:disable-next-line:no-console
                    console.log(chalk.red("Warning"), " cannot raise event :  transition " + f + " to " + t + " is missing");
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
     * @private
     */
    public _post_initialize(): void {
        const addressSpace = this.addressSpace;
        const finiteStateMachineType = addressSpace.findObjectType("FiniteStateMachineType");
        if (!finiteStateMachineType) {
            throw new Error("cannot find FiniteStateMachineType");
        }

        // xx assert(this.typeDefinitionObj && !this.subtypeOfObj);
        // xx assert(!this.typeDefinitionObj || this.typeDefinitionObj.isSupertypeOf(finiteStateMachineType));
        // get current Status

        const d = this.currentState.readValue();

        if (d.statusCode !== StatusCodes.Good) {
            this.setState(null);
        } else {
            const txt =
                d.value && d.value.value ? (d.value.value.text ? d.value.value.text.toString() : d.value.value.toString()) : "";
            this.currentStateNode = this.getStateByName(txt);
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
