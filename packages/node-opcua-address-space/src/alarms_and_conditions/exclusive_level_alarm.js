"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

const util = require("util");
const AddressSpace =require("../address_space").AddressSpace;
const Namespace = require("../namespace").Namespace;

const UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;

/**
 * @class UAExclusiveLevelAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
function UAExclusiveLevelAlarm() {
}
util.inherits(UAExclusiveLevelAlarm, UAExclusiveLimitAlarm);
exports.UAExclusiveLevelAlarm =UAExclusiveLevelAlarm;

UAExclusiveLevelAlarm.instantiate = function(namespace,type,option,data) {

    assert(namespace instanceof Namespace);
    const addressSpace = namespace.addressSpace;
    assert(addressSpace instanceof AddressSpace);

    return UAExclusiveLimitAlarm.instantiate(namespace, type, option, data);
};
