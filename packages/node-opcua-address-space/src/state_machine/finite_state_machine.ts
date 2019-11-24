/**
 * @module node-opcua-address-space
 */
import * as chalk from "chalk";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { coerceLocalizedText, NodeClass } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import {
    State,
    Transition,
    UAObject as UAObjectPublic,
    UAVariable as UAVariablePublic
} from "../../source";

import { BaseNode } from "../base_node";
import { UAObject } from "../ua_object";
import { UAObjectType } from "../ua_object_type";
const doDebug = false;

function getComponentFromTypeAndSubtype(typeDef: any): any[] {

    const components_parts = [];
    components_parts.push(typeDef.getComponents());

    while (typeDef.subtypeOfObj) {
        typeDef = typeDef.subtypeOfObj;
        components_parts.push(typeDef.getComponents());
    }
    return [].concat.apply([], components_parts);
}

export interface StateMachine {
    /**
     * @property currentState
     */
    currentState: UAVariablePublic;
    _currentStateNode: State | null;
}

/*
 *
 * @class StateMachine
 * @constructor
 * @extends UAObject
 *
 *
 */
export class StateMachine extends UAObject implements StateMachine {

    public getStates(): UAObject[] {

        const addressSpace = this.addressSpace;

        const initialStateType = addressSpace.findObjectType("InitialStateType");
        if (!initialStateType) {
            throw new Error("cannot find InitialStateType");
        }

        const stateType = addressSpace.findObjectType("StateType");
        if (!stateType) {
            throw new Error("cannot find StateType");
        }

        assert((initialStateType as any).isSupertypeOf(stateType));

        const typeDef = this.typeDefinitionObj;

        let comp = getComponentFromTypeAndSubtype(typeDef);

        comp = comp.filter((c: any) => {
            if (!(c.typeDefinitionObj instanceof UAObjectType)) {
                return false;
            }
            return c.typeDefinitionObj.isSupertypeOf(stateType);
        });

        return comp;
    }

    public get states(): any[] {
        return this.getStates();
    }

    /**
     * @method getStateByName
     * @param name  the name of the state to get
     * @return the state with the given name
     */
    public getStateByName(name: string): State | null {
        let states = this.getStates();
        states = states.filter((s: any) => {
            return s.browseName.name === name;
        });
        assert(states.length <= 1);
        return states.length === 1 ? states[0] as any as State : null;
    }

    public getTransitions(): Transition[] {
        const addressSpace = this.addressSpace;

        const transitionType = addressSpace.findObjectType("TransitionType");
        const typeDef = this.typeDefinitionObj;

        let comp = getComponentFromTypeAndSubtype(typeDef);

        comp = comp.filter((c: any) => {
            if (!(c.typeDefinitionObj instanceof UAObjectType)) {
                return false;
            }
            return c.typeDefinitionObj.isSupertypeOf(transitionType);
        });

        return comp;
    }

    public get transitions(): Transition[] {
        return this.getTransitions();
    }

    /**
     * return the node InitialStateType
     * @property initialState
     */
    get initialState(): UAObject {
        const addressSpace = this.addressSpace;

        const initialStateType = addressSpace.findObjectType("InitialStateType");
        const typeDef = this.typeDefinitionObj;

        let comp = getComponentFromTypeAndSubtype(typeDef);

        comp = comp.filter((c: any) => c.typeDefinitionObj === initialStateType);

        // istanbul ignore next
        if (comp.length > 1) {
            throw new Error(" More than 1 initial state in stateMachine");
        }
        return comp.length === 0 ? null : comp[0];
    }

    /**
     *
     * @param node
     * @private
     */
    public _coerceNode(node: State | BaseNode | null | string | NodeId): BaseNode | null {

        if (node === null) {
            return null;
        }
        const addressSpace = this.addressSpace;
        if (node instanceof BaseNode) {
            return node;
        } else if (node instanceof NodeId) {
            return addressSpace.findNode(node) as BaseNode;

        } else if (_.isString(node)) {
            return this.getStateByName(node) as any as BaseNode;
        }
        return null;
    }

    /**
     * @method isValidTransition
     * @param toStateNode
     * @return {boolean}
     */
    public isValidTransition(toStateNode: State | string): boolean {

        // is it legal to go from state currentState to toStateNode;
        if (!this.currentStateNode) {
            return true;
        }
        const n = this.currentState.readValue();

        // to be executed there must be a transition from currentState to toState
        const transition = this.findTransitionNode(this.currentStateNode, toStateNode);
        if (!transition) {

            // istanbul ignore next
            if (doDebug) {
                // tslint:disable-next-line: no-console
                console.log(" No transition from ",
                    this.currentStateNode.browseName.toString(), " to ", toStateNode.toString());
            }
            return false;
        }
        return true;
    }

    /**
     */
    public findTransitionNode(
        fromStateNode: NodeId | State | string | null,
        toStateNode: NodeId | State | string | null
    ): Transition | null {

        const addressSpace = this.addressSpace;

        const _fromStateNode = this._coerceNode(fromStateNode);
        if (!_fromStateNode) {
            return null;
        }

        const _toStateNode = this._coerceNode(toStateNode);
        if (!_toStateNode) {
            return null;
        }

        assert(_fromStateNode instanceof UAObject);
        assert(_toStateNode instanceof UAObject);

        const stateType = addressSpace.findObjectType("StateType");
        if (!stateType) {
            throw new Error("Cannot find StateType");
        }
        assert((_fromStateNode.typeDefinitionObj as any).isSupertypeOf(stateType));
        assert((_toStateNode.typeDefinitionObj as any).isSupertypeOf(stateType));

        let transitions = _fromStateNode.findReferencesAsObject("FromState", false);

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
            // tslint:disable-next-line: no-console
            console.log("warning: a duplicated FromState Reference to the same target has been found.\nPlease check your model.");
            // tslint:disable-next-line: no-console
            console.log("fromStateNode: ", _fromStateNode.toString());
        }
        return transitions[0] as any as Transition;
    }

    public get currentStateNode(): State | null {
        return this._currentStateNode;
    }

    /**
     * @property currentStateNode
     * @type BaseNode
     */
    public set currentStateNode(value: State | null) {
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
    public setState(toStateNode: string | State | null): void {

        if (!toStateNode) {
            this.currentStateNode = null;
            this.currentState.setValueFromSource({ dataType: DataType.Null }, StatusCodes.BadStateNotActive);
            return;
        }

        if (_.isString(toStateNode)) {
            const state = this.getStateByName(toStateNode);
            // istanbul ignore next
            if (!state) {
                throw new Error("Cannot find state with name " + toStateNode);
            }
            assert(state.browseName.name!.toString() === toStateNode);
            toStateNode = state;
        }
        const fromStateNode = this.currentStateNode;

        toStateNode = this._coerceNode(toStateNode) as any as State;
        assert(toStateNode.nodeClass === NodeClass.Object);

        this.currentState.setValueFromSource({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText(toStateNode.browseName.toString())
        }, StatusCodes.Good);

        this.currentStateNode = toStateNode;

        const transitionNode = this.findTransitionNode(fromStateNode, toStateNode);

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
                "transition": {
                    dataType: "LocalizedText",
                    value: transitionNode.displayName[0]
                },

                "transition.id": transitionNode.transitionNumber.readValue().value,

                "fromState": {
                    dataType: "LocalizedText",
                    value: fromStateNode ? fromStateNode.displayName[0] : ""
                },   // StateVariableType

                "fromState.id": fromStateNode ? fromStateNode.stateNumber.readValue().value : {
                    dataType: "Null"
                },

                "toState": {
                    dataType: "LocalizedText",
                    value: toStateNode.displayName[0]
                },    // StateVariableType

                "toState.id": toStateNode.stateNumber.readValue().value
            });

        } else {
            if (fromStateNode && fromStateNode !== toStateNode) {
                if (doDebug) {
                    const f = fromStateNode.browseName.toString();
                    const t = toStateNode.browseName.toString();
                    // tslint:disable-next-line:no-console
                    console.log(chalk.red("Warning"),
                        " cannot raise event :  transition " + f + " to " + t + " is missing");
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
        // xxassert(!this.typeDefinitionObj || this.typeDefinitionObj.isSupertypeOf(finiteStateMachineType));
        // get current Status

        const d = this.currentState.readValue();

        if (d.statusCode !== StatusCodes.Good) {
            this.setState(null);
        } else {

            this.currentStateNode = this.getStateByName
                (d.value.value.text ? d.value.value.text.toString() : d.value.value.toString());
        }
    }
}

export function promoteToStateMachine(node: UAObjectPublic): StateMachine {
    if (node instanceof StateMachine) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, StateMachine.prototype);
    assert(node instanceof StateMachine, "should now  be a State Machine");
    (node as StateMachine)._post_initialize();
    return node as StateMachine;
}
