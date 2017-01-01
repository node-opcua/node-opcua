/**
 * @module opcua.address_space.AlarmsAndConditions
 */
exports.install = function (AddressSpace) {


     // └─ ConditionType
     //    ├─ DialogConditionType
     //    └─ AcknowledgeableConditionType
     //       └─ AlarmConditionType
     //          ├─ LimitAlarmType
     //          │  ├─ ExclusiveLimitAlarmType
     //          │  │  ├─ ExclusiveLevelAlarmType
     //          │  │  ├─ ExclusiveDeviationAlarmType
     //          │  │  └─ ExclusiveRateOfChangeAlarmType
     //          │  └─ NonExclusiveLimitAlarmType
     //          │     ├─ NonExclusiveLevelAlarmType
     //          │     ├─ NonExclusiveDeviationAlarmType
     //          │     └─ NonExclusiveRateOfChangeAlarmType
     //          └─ DiscreteAlarmType
     //             ├─ OffNormalAlarmType
     //             │  ├─ SystemOffNormalAlarmType
     //             │  │  └─ CertificateExpirationAlarmType
     //             │  └─ TripAlarmType

    var UAConditionBase = require("./condition").UAConditionBase;
    var UAAcknowledgeableConditionBase = require("./acknowledgeable_condition").UAAcknowledgeableConditionBase;

    /**
     * @class AddressSpace
     * @method installAlarmsAndConditionsService
     */
    AddressSpace.prototype.installAlarmsAndConditionsService = function () {
        UAConditionBase.install_condition_refresh_handle(this);
        UAAcknowledgeableConditionBase.install_method_handle_on_type(this);
    };

    /**
     * @class AddressSpace
     * @method instantiateCondition
     * @param  conditionTypeId
     * @param options
     * @param data
     * @return {UAConditionBase}
     */
    AddressSpace.prototype.instantiateCondition = function (conditionTypeId, options,data ) {
        return UAConditionBase.instantiate(this, conditionTypeId, options, data);
    };

    /**
     * @class AddressSpace
     * @method instantiateAcknowledgeableCondition
     * @param  conditionTypeId
     * @param  options
     * @param  data
     * @return {UAAcknowledgeableConditionBase}
     */
    AddressSpace.prototype.instantiateAcknowledgeableCondition = function (conditionTypeId, options,data ) {
        return UAAcknowledgeableConditionBase.instantiate(this, conditionTypeId, options, data);
    };

    var UAAlarmConditionBase = require("./alarm_condition").UAAlarmConditionBase;
    /**
     * @class AddressSpace
     * @method instantiateAlarmCondition
     * @param  alarmConditionTypeId
     * @param  options
     * @param  data
     * @return {UAAlarmConditionBase}
     */
    AddressSpace.prototype.instantiateAlarmCondition = function (alarmConditionTypeId, options,data ) {
        return UAAlarmConditionBase.instantiate(this, alarmConditionTypeId, options, data);
    };

    var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
    /**
     * @class AddressSpace
     * @method instantiateLimitAlarm
     * @param  limitAlarmTypeId
     * @param  options
     * @param  data
     * @return {UALimitAlarm}
     */
    AddressSpace.prototype.instantiateLimitAlarm = function (limitAlarmTypeId, options,data ) {
        return UALimitAlarm.instantiate(this, limitAlarmTypeId, options, data);
    };

    var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;
    /**
     * @class AddressSpace
     * @method instantiateExclusiveLimitAlarm
     * @param  exclusiveLimitAlarmTypeId
     * @param  options
     * @param  data
     * @return {UAExclusiveLimitAlarm}
     */
    AddressSpace.prototype.instantiateExclusiveLimitAlarm = function(exclusiveLimitAlarmTypeId, options,data ) {
        return UAExclusiveLimitAlarm.instantiate(this, exclusiveLimitAlarmTypeId, options, data);
    };

    var UAExclusiveDeviationAlarm = require("./exclusive_deviation_alarm").UAExclusiveDeviationAlarm;
    /**
     * @class AddressSpace
     * @method instantiateExclusiveDeviationAlarm
     * @param  options
     * @param  data
     * @return {UAExclusiveDeviationAlarm}
     */
    AddressSpace.prototype.instantiateExclusiveDeviationAlarm = function(options,data ) {
        return UAExclusiveDeviationAlarm.instantiate(this, "ExclusiveDeviationAlarmType", options, data);
    };

    var UANonExclusiveLimitAlarm = require("./non_exclusive_limit_alarm").UANonExclusiveLimitAlarm;
    /**
     * @class AddressSpace
     * @method instantiateNonExclusiveLimitAlarm
     * @param  nonExclusiveLimitAlarmTypeId
     * @param  options
     * @param  data
     * @return {UANonExclusiveLimitAlarm}
     */
    AddressSpace.prototype.instantiateNonExclusiveLimitAlarm = function (nonExclusiveLimitAlarmTypeId, options, data) {
        return UANonExclusiveLimitAlarm.instantiate(this, nonExclusiveLimitAlarmTypeId, options, data);
    };

    var UANonExclusiveDeviationAlarm = require("./non_exclusive_deviation_alarm").UANonExclusiveDeviationAlarm;
    /**
     * @class AddressSpace
     * @method instantiateNonExclusiveDeviationAlarm
     * @param  options
     * @param  data
     * @return {UANonExclusiveDeviationAlarm}
     */
    AddressSpace.prototype.instantiateNonExclusiveDeviationAlarm = function(options,data ) {
        return UANonExclusiveDeviationAlarm.instantiate(this, "NonExclusiveDeviationAlarmType", options, data);
    };


    // --------------------------------- Discrete Alarms
    var UADiscreteAlarm = require("./discrete_alarm").UADiscreteAlarm;
    /**
     * @class AddressSpace
     * @method instantiateOffNormalAlarm
     * @param  options
     * @param  data
     * @return {UAOffNormalAlarm}
     */
    AddressSpace.prototype.instantiateDiscreteAlarm = function (discreteAlarmType,options, data) {
        return UADiscreteAlarm.instantiate(this, discreteAlarmType, options, data);
    };

    var UAOffNormalAlarm = require("./off_normal_alarm").UAOffNormalAlarm;
    /**
     * @class AddressSpace
     * @method instantiateOffNormalAlarm
     * @param  options
     * @param  data
     * @return {UAOffNormalAlarm}
     */
    AddressSpace.prototype.instantiateOffNormalAlarm = function (options, data) {
        return UAOffNormalAlarm.instantiate(this, "OffNormalAlarmType", options, data);
    };

//xx    require("lib/address_space/alarms_and_conditions/acknowledgeable_condition").install(AddressSpace);
//xx    require("lib/address_space/alarms_and_conditions/alarm_condition").install(AddressSpace);
//xx    require("lib/address_space/alarms_and_conditions/limit_alarm").install(AddressSpace);


};
