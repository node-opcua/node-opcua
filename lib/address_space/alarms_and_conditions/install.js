/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import UAConditionBase  from "./UAConditionBase";
import UAAcknowledgeableConditionBase from "./UAAcknowledgeableConditionBase";
import UAAlarmConditionBase from "./UAAlarmConditionBase";
import UALimitAlarm from "./UALimitAlarm";
import UAExclusiveLimitAlarm from "./UAExclusiveLimitAlarm";
import UAExclusiveDeviationAlarm from "./UAExclusiveDeviationAlarm";
import UANonExclusiveLimitAlarm from "./UANonExclusiveLimitAlarm";
import UANonExclusiveDeviationAlarm from "./UANonExclusiveDeviationAlarm";
import UADiscreteAlarm from "./UADiscreteAlarm";
import UAOffNormalAlarm from "./UAOffNormalAlarm";

function install(AddressSpace) {
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
  AddressSpace.prototype.instantiateCondition = function (conditionTypeId, options,data) {
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
  AddressSpace.prototype.instantiateAcknowledgeableCondition = function (conditionTypeId, options,data) {
    return UAAcknowledgeableConditionBase.instantiate(this, conditionTypeId, options, data);
  };

    /**
     * @class AddressSpace
     * @method instantiateAlarmCondition
     * @param  alarmConditionTypeId
     * @param  options
     * @param  data
     * @return {UAAlarmConditionBase}
     */
  AddressSpace.prototype.instantiateAlarmCondition = function (alarmConditionTypeId, options,data) {
    return UAAlarmConditionBase.instantiate(this, alarmConditionTypeId, options, data);
  };

    /**
     * @class AddressSpace
     * @method instantiateLimitAlarm
     * @param  limitAlarmTypeId
     * @param  options
     * @param  data
     * @return {UALimitAlarm}
     */
  AddressSpace.prototype.instantiateLimitAlarm = function (limitAlarmTypeId, options,data) {
    return UALimitAlarm.instantiate(this, limitAlarmTypeId, options, data);
  };

    /**
     * @class AddressSpace
     * @method instantiateExclusiveLimitAlarm
     * @param  exclusiveLimitAlarmTypeId
     * @param  options
     * @param  data
     * @return {UAExclusiveLimitAlarm}
     */
  AddressSpace.prototype.instantiateExclusiveLimitAlarm = function (exclusiveLimitAlarmTypeId, options,data) {
    return UAExclusiveLimitAlarm.instantiate(this, exclusiveLimitAlarmTypeId, options, data);
  };

    /**
     * @class AddressSpace
     * @method instantiateExclusiveDeviationAlarm
     * @param  options
     * @param  data
     * @return {UAExclusiveDeviationAlarm}
     */
  AddressSpace.prototype.instantiateExclusiveDeviationAlarm = function (options,data) {
    return UAExclusiveDeviationAlarm.instantiate(this, "ExclusiveDeviationAlarmType", options, data);
  };

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

    /**
     * @class AddressSpace
     * @method instantiateNonExclusiveDeviationAlarm
     * @param  options
     * @param  data
     * @return {UANonExclusiveDeviationAlarm}
     */
  AddressSpace.prototype.instantiateNonExclusiveDeviationAlarm = function (options,data) {
    return UANonExclusiveDeviationAlarm.instantiate(this, "NonExclusiveDeviationAlarmType", options, data);
  };


    // --------------------------------- Discrete Alarms
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

}

export default install;
