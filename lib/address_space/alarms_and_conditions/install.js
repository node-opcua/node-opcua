


exports.install = function (AddressSpace) {

    var UAConditionBase = require("./condition").UAConditionBase;
    AddressSpace.prototype.installAlarmsAndConditionsService = function () {
        UAConditionBase.install_condition_refresh_handle(this);
    };

    AddressSpace.prototype.instantiateCondition = function (conditionTypeId, options,data ) {
        return UAConditionBase.instantiate(this,conditionTypeId,options,data);
    };

    var UAAcknowledgeableConditionBase = require("./acknowledgeable_condition").UAAcknowledgeableConditionBase;
    AddressSpace.prototype.instantiateAcknowledgeableCondition = function (conditionTypeId, options,data ) {
        return UAAcknowledgeableConditionBase.instantiate(this,conditionTypeId, options,data);
    };

    var UAAlarmConditionBase = require("./alarm_condition").UAAlarmConditionBase;
    AddressSpace.prototype.instantiateAlarmCondition = function (alarmConditionTypeId, options,data ) {
        return UAAlarmConditionBase.instantiate(this,alarmConditionTypeId,options,data);
    };

    var UALimitAlarm = require("./limit_alarm").UALimitAlarm;
    AddressSpace.prototype.instantiateLimitAlarm = function (limitAlarmTypeId, options,data ) {
        return UALimitAlarm.instantiate(this,limitAlarmTypeId,options,data);
    };

    var UAExclusiveLimitAlarm = require("./exclusive_limit_alarm").UAExclusiveLimitAlarm;
    AddressSpace.prototype.instantiateExclusiveLimitAlarm = function(exclusiveLimitAlarmTypeId, options,data ) {
        return UAExclusiveLimitAlarm.instantiate(this,exclusiveLimitAlarmTypeId,options,data);
    };

    var UAExclusiveLevelAlarm = require("./exclusive_level_alarm").UAExclusiveLevelAlarm;
    AddressSpace.prototype.instantiateExclusiveDeviationAlarm = function(options,data ) {
        return UAExclusiveLevelAlarm.instantiate(this,"ExclusiveLevelAlarmType",options,data);
    };

    var UAExclusiveDeviationAlarm = require("./exclusive_deviation_alarm").UAExclusiveDeviationAlarm;
    AddressSpace.prototype.instantiateExclusiveDeviationAlarm = function(options,data ) {
        return UAExclusiveDeviationAlarm.instantiate(this,"ExclusiveDeviationAlarmType",options,data);
    };



    var UANonExclusiveLimitAlarm = require("./non_exclusive_limit_alarm").UANonExclusiveLimitAlarm;
    AddressSpace.prototype.instantiateNonExclusiveLimitAlarm = function (nonExclusiveLimitAlarmTypeId, options, data) {
        return UANonExclusiveLimitAlarm.instantiate(this,nonExclusiveLimitAlarmTypeId,options,data);
    };

//xx    require("lib/address_space/alarms_and_conditions/acknowledgeable_condition").install(AddressSpace);
//xx    require("lib/address_space/alarms_and_conditions/alarm_condition").install(AddressSpace);
//xx    require("lib/address_space/alarms_and_conditions/limit_alarm").install(AddressSpace);


};
