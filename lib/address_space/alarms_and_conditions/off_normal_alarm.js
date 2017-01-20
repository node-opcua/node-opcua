/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import util from "util";
import assert from "assert";
import _ from "underscore";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { DataType } from "lib/datamodel/variant";

import { isNullOrUndefined } from "lib/misc/utils";

/**
 * @module opcua.address_space
 * @inherit UADiscreteAlarm
 * @class AddressSpace
 */

import { UADiscreteAlarm } from "./discrete_alarm";

/**
 * The OffNormalAlarmType is a specialization of the DiscreteAlarmType intended to represent a
 * discrete Condition that is considered to be not normal.
 * This sub type is usually used to indicate that a discrete value is in an Alarm state, it is active as
 * long as a non-normal value is present.
 * @class UAOffNormalAlarm
 * @extends UADiscreteAlarm
 * @constructor
 */
class UAOffNormalAlarm extends UADiscreteAlarm {
  /**
   * @method getNormalStateNode
   * @returns {BaseNode}
   */
  getNormalStateNode() {
    const nodeId = this.normalState.readValue().value.value;
    const node = this.addressSpace.findNode(nodeId);
    assert(node,"getNormalStateNode ");
    return node;
  }

  /**
   * @method getNormalStateValue
   * @returns {Any}
   */
  getNormalStateValue() {
    const normalStateNode = this.getNormalStateNode();
    return normalStateNode.readValue().value.value;
  }

  /**
   * @method setNormalStateValue
   * @param value
   */
  setNormalStateValue(value) {
    const normalStateNode = this.getNormalStateNode();
    throw new Error("Not Implemented yet");
  }

  _updateAlarmState(normalStateValue, inputValue) {
    if (isNullOrUndefined(normalStateValue) || isNullOrUndefined(inputValue)) {
      this.activeState.setValue(false);
    }
    const activate = (normalStateValue != inputValue);
    this.activeState.setValue(activate);
  }

  _onInputDataValueChange(dataValue) {
    if (dataValue.statusCode !== StatusCodes.Good) {
          // what shall we do ?
      return;
    }
    if (dataValue.value.dataType === DataType.Null) {
          // what shall we do ?
      return;
    }
    const inputValue = dataValue.value.value;
    const normalStateValue = this.getNormalStateValue();
    this._updateAlarmState(normalStateValue,inputValue);
  }

  _onNormalStateDataValueChange(dataValue) {
    if (dataValue.statusCode !== StatusCodes.Good) {
          // what shall we do ?
      return;
    }
    if (dataValue.value.dataType === DataType.Null) {
          // what shall we do ?
      return;
    }
    const normalStateValue = dataValue.value.value;
    const inputValue = this.getInputNodeValue();
    this._updateAlarmState(normalStateValue,inputValue);
  }
}


/**
 * @method (static)UAOffNormalAlarm.instantiate
 * @param addressSpace
 * @param limitAlarmTypeId
 * @param options
 * @param data
 */
UAOffNormalAlarm.instantiate = (addressSpace, limitAlarmTypeId, options, data) => {
  const offNormalAlarmType = addressSpace.findEventType("OffNormalAlarmType");
    /* istanbul ignore next */
  if (!offNormalAlarmType) {
    throw new Error("cannot find offNormalAlarmType");
  }

  assert(options.hasOwnProperty("inputNode"),   "must provide inputNode");          // must provide a inputNode
  assert(options.hasOwnProperty("normalState"), "must provide a normalState Node"); // must provide a inputNode
  options.optionals = options.optionals || [];

  assert(options.hasOwnProperty("inputNode"), "must provide inputNode"); // must provide a inputNode
  const alarmNode = UADiscreteAlarm.instantiate(addressSpace, limitAlarmTypeId, options, data);
  Object.setPrototypeOf(alarmNode, UAOffNormalAlarm.prototype);

  const inputNode = addressSpace._coerceNode(options.inputNode);
  assert(inputNode, "Expecting a valid input node");

  const normalState = addressSpace._coerceNode(options.normalState);
  assert(normalState, "Expecting a valid normalState node");

  alarmNode.normalState.setValueFromSource({ dataType: DataType.NodeId, value: normalState.nodeId });

    // install inputNode monitoring for change
  inputNode.on("value_changed", (newDataValue, oldDataValue) => {
    alarmNode._onInputDataValueChange(newDataValue);
  });

  alarmNode.normalState.on("value_changed", (newDataValue, oldDataValue) => {
        // to do
        // we must remove listener on current normalState and replace normalState with the new one and
        // set listener again
  });

    // install normalState monitoring for change
  normalState.on("value_changed", (newDataValue, oldDataValue) => {
    alarmNode._onNormalStateDataValueChange(newDataValue);
  });

  alarmNode._updateAlarmState();

  return alarmNode;
};


/**
 * @class UASystemOffNormalAlarm
 * @constructor
 * @extends UAOffNormalAlarm
 * This Condition is used by a Server to indicate that an underlying system that is providing  Alarm information is
 * having a communication problem and that the Server may have invalid or incomplete Condition state in the
 * Subscription.
 */
class UASystemOffNormalAlarm extends UAOffNormalAlarm {}

export { UAOffNormalAlarm };
