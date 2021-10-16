/**
 * @module node-opcua-client-proxy
 */
import { assert } from "node-opcua-assert";
import { makeProxyState, ProxyState } from "./proxy_state";
import { makeProxyTransition, ProxyNode, ProxyTransition } from "./proxy_transition";

export class ProxyStateMachineType {
    public initialState: ProxyState | undefined;
    public states: ProxyState[];
    public transitions: ProxyTransition[];

    constructor(obj: ProxyNode) {
        const localInitialState = obj.$components.filter((component: any) => {
            if (!component.typeDefinition) {
                return false;
            }
            return component.typeDefinition.toString() === "InitialStateType";
        });

        if (localInitialState.length) {
            assert(localInitialState.length === 1);
            this.initialState = new ProxyState(localInitialState[0]);
        } else {
            this.initialState = undefined;
        }

        this.states = obj.$components
            .filter((component: any) => {
                if (!component.typeDefinition) {
                    return false;
                }
                return component.typeDefinition.toString() === "StateType";
            })
            .map(makeProxyState);

        this.transitions = obj.$components
            .filter((component: ProxyNode) => {
                if (!component.typeDefinition) {
                    return false;
                }
                return component.typeDefinition.toString() === "TransitionType";
            })
            .map(makeProxyTransition);
    }

    // var initialStateTypeId = makeRefId("InitialStateType");
    //
    // var initialStateType = addressSpace.findObjectType("InitialStateType");
    // should(!!initialStateType).eql(true);
    //
    // var stateType = addressSpace.findObjectType("StateType");
    // should(!!stateType).eql(true);
    //
    // var transitionType = addressSpace.findObjectType("TransitionType");
    // should(!!transitionType).eql(true);

    // }
}
