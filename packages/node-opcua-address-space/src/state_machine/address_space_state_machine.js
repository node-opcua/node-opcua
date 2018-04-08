"use strict";


const assert = require("node-opcua-assert").assert;
const _ = require("underscore");


const DataType = require("node-opcua-variant").DataType;

/**
 * @module opcua.address_space
 */

exports.install = function (AddressSpace) {

    const UAObjectType = require("./../ua_object_type").UAObjectType;
    /**
     * @class AddressSpace
     * @method addState
     * @param component
     * @param stateName   {string}
     * @param stateNumber {number}
     * @param isInitialState {boolean}
     * @return {UAObject} {StateType|InitialStateType}
     */
    AddressSpace.prototype.addState = function (component, stateName, stateNumber, isInitialState) {

        const addressSpace = this;

        isInitialState = !!isInitialState;

        assert(component instanceof UAObjectType);
        assert(_.isString(stateName));
        assert(_.isBoolean(isInitialState));

        const initialStateType = addressSpace.findObjectType("InitialStateType");
        const stateType = addressSpace.findObjectType("StateType");

        let state;
        if (isInitialState) {
            state = initialStateType.instantiate({
                browseName: stateName,
                componentOf: component
            });
        } else {
            state = stateType.instantiate({
                browseName: stateName,
                componentOf: component
            });
        }
        // ensure state number is unique
        state.stateNumber.setValueFromSource({
            dataType: DataType.UInt32,
            value: stateNumber
        });
        return state;
    };


    /**
     * @method addTransition
     * @param component         {UAObject}
     * @param fromState         {StateType|InitialStateType}
     * @param toState           {StateType|InitialStateType}
     * @param transitionNumber {Number}
     * @return {UAObject}  TransitionType
     */
    AddressSpace.prototype.addTransition = function (component, fromState, toState, transitionNumber) {

        const addressSpace = this;

        assert(component instanceof UAObjectType);
        assert(_.isString(fromState));
        assert(_.isString(toState));
        assert(_.isFinite(transitionNumber));

        const fromStateNode = component.getComponentByName(fromState);

        // istanbul ignore next
        if (!fromStateNode) {
            throw new Error("Cannot find state with name " + fromState);
        }
        assert(fromStateNode.browseName.name.toString() === fromState);

        const toStateNode = component.getComponentByName(toState);

        // istanbul ignore next
        if (!toStateNode) {
            throw new Error("Cannot find state with name " + toState);
        }
        assert(toStateNode && toStateNode.browseName.name.toString() === toState);

        const transitionType = addressSpace.findObjectType("TransitionType");

        const transition = transitionType.instantiate({
            browseName: fromState + "To" + toState + "Transition",
            componentOf: component
        });

        transition.addReference({
            referenceType: "ToState",
            isForward: true,
            nodeId: toStateNode.nodeId
        });
        transition.addReference({
            referenceType: "FromState",
            isForward: true,
            nodeId: fromStateNode.nodeId
        });

        transition.transitionNumber.setValueFromSource({
            dataType: DataType.UInt32, value: transitionNumber
        })

    };

};

