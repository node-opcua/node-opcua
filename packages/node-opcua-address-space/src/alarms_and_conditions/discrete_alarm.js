"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */


const util = require("util");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const StatusCodes = require("node-opcua-status-code").StatusCodes;
const DataType = require("node-opcua-variant").DataType;
const AddressSpace =require("../address_space").AddressSpace;

const UAAlarmConditionBase = require("./alarm_condition").UAAlarmConditionBase;

/*=
 *      +----------------------+
 *      | UAAlarmConditionBase |
 *      +----------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UADiscreteAlarm  |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      | UAOffNormalAlarm |
 *      +------------------+
 *               ^
 *               |
 *      +--------+---------+
 *      |   UATripAlarm    |
 *      +------------------+
 *
 *
 *
 */

/**
 * @class UADiscreteAlarm
 * @extends UAAlarmConditionBase
 * @constructor
 * The DiscreteAlarmType is used to classify Types into Alarm Conditions where the input for the
 * Alarm may take on only a certain number of possible values (e.g. true/false,
 * running/stopped/terminating).
 */
function UADiscreteAlarm() {
}
util.inherits(UADiscreteAlarm, UAAlarmConditionBase);

UADiscreteAlarm.instantiate = function(addressSpace, discreteAlarmTypeId, options, data) {

    assert(addressSpace instanceof AddressSpace);

    const discreteAlarmType = addressSpace.findEventType(discreteAlarmTypeId);
    /* istanbul ignore next */
    if (!discreteAlarmType) {
        throw new Error(" cannot find Condition Type for " + discreteAlarmType);
    }

    const discreteAlarmTypeBase = addressSpace.findObjectType("DiscreteAlarmType");
    assert(discreteAlarmTypeBase,"expecting DiscreteAlarmType - please check you nodeset xml file!");

    /* eventTypeNode should be subtypeOf("DiscreteAlarmType"); */
    /* istanbul ignore next */
    if (!discreteAlarmType.isSupertypeOf(discreteAlarmTypeBase)) {
        throw new Error("UADiscreteAlarm.instantiate : event found is not subType of DiscreteAlarmType");
    }

    const alarmNode = UAAlarmConditionBase.instantiate(addressSpace, discreteAlarmType, options, data);
    Object.setPrototypeOf(alarmNode, UADiscreteAlarm.prototype);

    return alarmNode;
};
module.exports.UADiscreteAlarm = UADiscreteAlarm;



