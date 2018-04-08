"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */

require("set-prototype-of");
const EventEmitter = require("events").EventEmitter;
const util = require("util");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");

const UAVariable = require("../ua_variable").UAVariable;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const StatusCode = require("node-opcua-status-code").StatusCode;
const UAObjectType = require("../ua_object_type").UAObjectType;
const UAObject = require("../ua_object").UAObject;
const BaseNode = require("../base_node").BaseNode;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const NodeClass = require("node-opcua-data-model").NodeClass;
const TimeZone = require("node-opcua-data-model").TimeZone;
const UAStateMachine = require("../state_machine/finite_state_machine").UAStateMachine;
const UATwoStateVariable = require("../ua_two_state_variable").UATwoStateVariable;

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
const LocalizedText = require("node-opcua-data-model").LocalizedText;
const NodeId = require("node-opcua-nodeid").NodeId;

const EventData = require("../address_space_add_event_type").EventData;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const AddressSpace = require("../address_space").AddressSpace;
const SessionContext = require("../session_context").SessionContext;

const utils = require("node-opcua-utils");

function _visit(self, node, prefix) {
    const aggregates = node.getAggregates();

    aggregates.forEach(function(aggregate) {
        if (aggregate instanceof UAVariable) {
            let name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            const key = prefix + name;

            // istanbul ignore next
            if (doDebug) {
                debugLog("adding key =", key);
            }
            self._map[key] = aggregate.readValue().value;
            self._node_index[key] = aggregate;
            _visit(self, aggregate, prefix + name + ".");
        }
    });
}
function _installOnChangeEventHandlers(self, node, prefix) {
    const aggregates = node.getAggregates();

    aggregates.forEach(function(aggregate) {
        if (aggregate instanceof UAVariable) {
            let name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            const key = prefix + name;

            // istanbul ignore next
            if (doDebug) {
                debugLog("adding key =", key);
            }

            aggregate.on("value_changed", function(newDataValue, oldDataValue) {
                self._map[key] = newDataValue.value;
                self._node_index[key] = aggregate;
            });

            _installOnChangeEventHandlers(self, aggregate, prefix + name + ".");
        }
    });
}
function _ensure_condition_values_correctness(self, node, prefix, error) {
    const displayError = !!error;
    error = error || [];

    const aggregates = node.getAggregates();

    aggregates.forEach(function(aggregate) {
        if (aggregate instanceof UAVariable) {
            let name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            const key = prefix + name;

            const snapshot_value = self._map[key].toString();
            const condition_value = aggregate.readValue().value.toString();

            if (snapshot_value !== condition_value) {
                error.push(
                    " Condition Branch0 is not in sync with node values for " +
                        key +
                        "\n v1= " +
                        snapshot_value +
                        "\n v2= " +
                        condition_value
                );
            }

            self._node_index[key] = aggregate;
            _ensure_condition_values_correctness(self, aggregate, prefix + name + ".", error);
        }
    });
    if (displayError && error.length) {
        throw new Error(error.join("\n"));
    }
}
function _record_condition_state(self, condition) {
    self._map = {};
    self._node_index = {};
    assert(condition instanceof UAConditionBase);
    _visit(self, condition, "");
}
/**
 * @class ConditionSnapshot
 * @extends EventEmitter
 * @param condition
 * @param branchId
 * @constructor
 */
function ConditionSnapshot(condition, branchId) {
    const self = this;
    EventEmitter.call(this);
    if (condition && branchId) {
        assert(branchId instanceof NodeId);
        //xx self.branchId = branchId;
        self.condition = condition;
        self.eventData = new EventData(condition);
        // a nodeId/Variant map
        _record_condition_state(self, condition);

        if (branchId === NodeId.NullNodeId) {
            _installOnChangeEventHandlers(self, condition, "");
        }

        self._set_var("branchId", DataType.NodeId, branchId);
    }
}
util.inherits(ConditionSnapshot, EventEmitter);

// /**
//  *
//  * @return {ConditionSnapshot}
//  */
// ConditionSnapshot.prototype.clone = function () {
//     var self = this;
//     var clone = new ConditionSnapshot();
//     clone.branchId = self.branchId;
//     clone.condition = self.condition;
//     //xx clone.eventData = new EventData(clone.condition);
//     clone._map = _.clone(self._map);
//     return clone;
// };

const disabledVar = new Variant({
    dataType: "StatusCode",
    value: StatusCodes.BadConditionDisabled
});

ConditionSnapshot.prototype._constructEventData = function() {
    const self = this;
    const addressSpace = self.condition.addressSpace;

    if (self.branchId === NodeId.NullNodeId) {
        _ensure_condition_values_correctness(self, self.condition, "");
    }

    const isDisabled = !self.condition.getEnabledState();
    const eventData = new EventData(self.condition);
    Object.keys(self._map).forEach(function(key) {
        const node = self._node_index[key];
        if (isDisabled && !_varTable.hasOwnProperty(key)) {
            eventData.setValue(key, node, disabledVar);
        } else {
            eventData.setValue(key, node, self._map[key]);
        }
    });

    return eventData;

    // self.condition.getAggregates().forEach(function(child){
    //     if (child instanceof UAVariable) {
    //         var name = utils.lowerFirstLetter(child.browseName.toString());
    //         self.eventData[name] =child.readValue().value;
    //     }
    // });
    // return self.eventData.clone();
};

/**
 * @method resolveSelectClause
 * @param selectClause {SelectClause}
 */
ConditionSnapshot.prototype.resolveSelectClause = function(selectClause) {
    const self = this;
    return self.eventData.resolveSelectClause(selectClause);
};

/**
 * @method readValue
 * @param nodeId {NodeId}
 * @param selectClause {SelectClause}
 * @return {Variant}
 */
ConditionSnapshot.prototype.readValue = function(nodeId, selectClause) {
    const self = this;

    const isDisabled = !self.condition.getEnabledState();
    if (isDisabled) {
        return disabledVar;
    }

    const key = nodeId.toString();
    const variant = self._map[key];
    if (!variant) {
        // the value is not handled by us .. let's delegate
        // to the eventData helper object
        return self.eventData.readValue(nodeId, selectClause);
    }
    assert(variant instanceof Variant);
    return variant;
};

function normalizeName(str) {
    return str
        .split(".")
        .map(utils.lowerFirstLetter)
        .join(".");
}
ConditionSnapshot.normalizeName = normalizeName;

// list of Condition variables that should not be published as BadConditionDisabled when the condition
// is in a disabled state.
var _varTable = {
    branchId: 1,
    eventId: 1,
    eventType: 1,
    sourceNode: 1,
    sourceName: 1,
    time: 1,
    enabledState: 1,
    "enabledState.id": 1,
    "enabledState.effectiveDisplayName": 1,
    "enabledState.transitionTime": 1,
    conditionClassId: 1,
    conditionClassName: 1,
    conditionName: 1
};
ConditionSnapshot.prototype._get_var = function(varName, dataType) {
    const self = this;

    if (!self.condition.getEnabledState() && !_varTable.hasOwnProperty(varName)) {
        console.log("ConditionSnapshot#_get_var condition enabled =", self.condition.getEnabledState());
        return disabledVar;
    }

    const key = normalizeName(varName);
    const variant = self._map[key];
    return variant.value;
};

ConditionSnapshot.prototype._set_var = function(varName, dataType, value) {
    const self = this;

    const key = normalizeName(varName);
    // istanbul ignore next
    if (!self._map.hasOwnProperty(key)) {
        if (doDebug) {
            debugLog(" cannot find node ".white.bold.bgRed + varName.cyan);
            debugLog("  map=", Object.keys(self._map).join(" "));
        }
    }
    self._map[key] = new Variant({
        dataType: dataType,
        value: value
    });

    if (self._map[key + ".sourceTimestamp"]) {
        self._map[key + ".sourceTimestamp"] = new Variant({
            dataType: DataType.DateTime,
            value: new Date()
        });
    }

    const variant = self._map[key];
    const node = self._node_index[key];
    assert(node instanceof UAVariable);
    self.emit("value_changed", node, variant);
};

/**
 * @method getBrandId
 * @return {NodeId}
 */
ConditionSnapshot.prototype.getBranchId = function() {
    const self = this;
    return self._get_var("branchId", DataType.NodeId);
};

/**
 * @method getEventId
 * @return {ByteString}
 */
ConditionSnapshot.prototype.getEventId = function() {
    const self = this;
    return self._get_var("eventId", DataType.ByteString);
};
/**
 * @method getRetain
 * @return {Boolean}
 */
ConditionSnapshot.prototype.getRetain = function() {
    const self = this;
    return self._get_var("retain", DataType.Boolean);
};

/**
 *
 * @method setRetain
 * @param retainFlag {Boolean}
 */
ConditionSnapshot.prototype.setRetain = function(retainFlag) {
    const self = this;
    retainFlag = !!retainFlag;
    return self._set_var("retain", DataType.Boolean, retainFlag);
};

/**
 * @method renewEventId
 *
 */
ConditionSnapshot.prototype.renewEventId = function() {
    const self = this;
    const addressSpace = self.condition.addressSpace;
    // create a new event  Id for this new condition
    const eventId = addressSpace.generateEventId();
    const ret = self._set_var("eventId", DataType.ByteString, eventId.value);

    //xx var branch = self; console.log("MMMMMMMMrenewEventId branch  " +  branch.getBranchId().toString() + " eventId = " + branch.getEventId().toString("hex"));

    return ret;
};

/**
 * @method getEnabledState
 * @return {Boolean}
 */
ConditionSnapshot.prototype.getEnabledState = function() {
    const self = this;
    return self._get_twoStateVariable("enabledState");
};
/**
 * @method setEnabledState
 * @param value {Boolean}
 * @return void
 */
ConditionSnapshot.prototype.setEnabledState = function(value) {
    const self = this;
    return self._set_twoStateVariable("enabledState", value);
};
/**
 * @method getEnabledStateAsString
 * @return {String}
 */
ConditionSnapshot.prototype.getEnabledStateAsString = function() {
    const self = this;
    return self._get_var("enabledState", DataType.LocalizedText).text;
};

/**
 * @method getComment
 * @return {LocalizedText}
 */
ConditionSnapshot.prototype.getComment = function() {
    const self = this;
    return self._get_var("comment", DataType.LocalizedText);
};

/**
 * Set condition comment
 *
 * Comment contains the last comment provided for a certain state (ConditionBranch). It may
 * have been provided by an AddComment Method, some other Method or in some other
 * manner. The initial value of this Variable is null, unless it is provided in some other manner. If
 * a Method provides as an option the ability to set a Comment, then the value of this Variable is
 * reset to null if an optional comment is not provided.
 *
 * @method setComment
 * @param txtMessage {LocalizedText}
 */
ConditionSnapshot.prototype.setComment = function(txtMessage) {
    const self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    self._set_var("comment", DataType.LocalizedText, txtMessage);
    /*
     * OPCUA Spec 1.0.3 - Part 9:
     * Comment, severity and quality are important elements of Conditions and any change
     * to them will cause Event Notifications.
     *
     */
    self._need_event_raise = true;
};

/**
 *
 * @method setMessage
 * @param txtMessage {LocalizedText}
 */
ConditionSnapshot.prototype.setMessage = function(txtMessage) {
    const self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    return self._set_var("message", DataType.LocalizedText, txtMessage);
};

/**
 * @method setClientUserId
 * @param userIdentity {String}
 */
ConditionSnapshot.prototype.setClientUserId = function(userIdentity) {
    const self = this;
    return self._set_var("clientUserId", DataType.String, userIdentity.toString());
};

/*
 *
 *
 * as per spec 1.0.3 - Part 9
 *
 * Quality reveals the status of process values or other resources that this Condition instance is
 * based upon. If, for example, a process value is “Uncertain”, the associated “LevelAlarm”
 * Condition is also questionable. Values for the Quality can be any of the OPC StatusCodes
 * defined in Part 8 as well as Good, Uncertain and Bad as defined in Part 4. These
 * StatusCodes are similar to but slightly more generic than the description of data quality in the
 * various field bus specifications. It is the responsibility of the Server to map internal status
 * information to these codes. A Server which supports no quality information shall return Good.
 * This quality can also reflect the communication status associated with the system that this
 * value or resource is based on and from which this Alarm was received. For communication
 * errors to the underlying system, especially those that result in some unavailable Event fields,
 * the quality shall be Bad_NoCommunication error.
 *
 * Quality refers to the quality of the data value(s) upon which this Condition is based. Since a
 * Condition is usually based on one or more Variables, the Condition inherits the quality of
 * these Variables. E.g., if the process value is “Uncertain”, the “LevelAlarm” Condition is also
 * questionable. If more than one variable is represented by a given condition or if the condition
 * is from an underlining system and no direct mapping to a variable is available, it is up to the
 * application to determine what quality is displayed as part of the condition.
 */

/**
 * set the condition quality
 * @method setQuality
 * @param quality {StatusCode}
 */
ConditionSnapshot.prototype.setQuality = function(quality) {
    const self = this;
    assert(quality instanceof StatusCode);
    assert(quality.hasOwnProperty("value") || "quality must be a StatusCode");
    self._set_var("quality", DataType.StatusCode, quality);
    /*
     * OPCUA Spec 1.0.3 - Part 9:
     * Comment, severity and quality are important elements of Conditions and any change
     * to them will cause Event Notifications.
     *
     */
    self._need_event_raise = true;
};

/**
 * @method getQuality
 * @return {StatusCode}
 */
ConditionSnapshot.prototype.getQuality = function() {
    const self = this;
    return self._get_var("quality", DataType.StatusCode);
};

/*
 * as per spec 1.0.3 - Part 9
 * The Severity of a Condition is inherited from the base Event model defined in Part 5. It
 * indicates the urgency of the Condition and is also commonly called ‘priority’, especially in
 * relation to Alarms in the ProcessConditionClass.
 *
 * as per spec 1.0.3 - PArt 5
 * Severity is an indication of the urgency of the Event. This is also commonly called “priority”.
 * Values will range from 1 to 1 000, with 1 being the lowest severity and 1 000 being the highest.
 * Typically, a severity of 1 would indicate an Event which is informational in nature, while a value
 * of 1 000 would indicate an Event of catastrophic nature, which could potentially result in severe
 * financial loss or loss of life.
 * It is expected that very few Server implementations will support 1 000 distinct severity levels.
 * Therefore, Server developers are responsible for distributing their severity levels across the
 * 1 to 1 000 range in such a manner that clients can assume a linear distribution. For example, a
 * client wishing to present five severity levels to a user should be able to do the following
 * mapping:
 *            Client Severity OPC Severity
 *                HIGH        801 – 1 000
 *                MEDIUM HIGH 601 – 800
 *                MEDIUM      401 – 600
 *                MEDIUM LOW  201 – 400
 *                LOW           1 – 200
 * In many cases a strict linear mapping of underlying source severities to the OPC Severity range
 * is not appropriate. The Server developer will instead intelligently map the underlying source
 * severities to the 1 to 1 000 OPC Severity range in some other fashion. In particular, it is
 * recommended that Server developers map Events of high urgency into the OPC severity range
 * of 667 to 1 000, Events of medium urgency into the OPC severity range of 334 to 666 and
 * Events of low urgency into OPC severities of 1 to 333.
 */
/**
 * @method setSeverity
 * @param severity {UInt16}
 */
ConditionSnapshot.prototype.setSeverity = function(severity) {
    const self = this;
    assert(_.isFinite(severity), "expecting a UInt16");

    // record automatically last severity
    const lastSeverity = self.getSeverity();
    self.setLastSeverity(lastSeverity);
    self._set_var("severity", DataType.UInt16, severity);
    /*
     * OPCUA Spec 1.0.3 - Part 9:
     * Comment, severity and quality are important elements of Conditions and any change
     * to them will cause Event Notifications.
     *
     */
    self._need_event_raise = true;
};

/**
 * @method getSeverity
 * @return {UInt16}
 */
ConditionSnapshot.prototype.getSeverity = function() {
    const self = this;
    assert(self.condition.getEnabledState(), "condition must be enabled");
    const value = self._get_var("severity", DataType.UInt16);
    return +value;
};

/*
 * as per spec 1.0.3 - part 9:
 *  LastSeverity provides the previous severity of the ConditionBranch. Initially this Variable
 *  contains a zero value; it will return a value only after a severity change. The new severity is
 *  supplied via the Severity Property which is inherited from the BaseEventType.
 *
 */
/**
 * @method setLastSeverity
 * @param severity {UInt16}
 */
ConditionSnapshot.prototype.setLastSeverity = function(severity) {
    const self = this;
    severity = +severity;
    return self._set_var("lastSeverity", DataType.UInt16, severity);
};
/**
 * @method getLastSeverity
 * @return {UInt16}
 */
ConditionSnapshot.prototype.getLastSeverity = function() {
    const self = this;
    const value = self._get_var("lastSeverity", DataType.UInt16);
    return +value;
};

/**
 * setReceiveTime
 *
 * (as per OPCUA 1.0.3 part 5)
 *
 * ReceiveTime provides the time the OPC UA Server received the Event from the underlying
 * device of another Server.
 *
 * ReceiveTime is analogous to ServerTimestamp defined in Part 4, i.e.
 * in the case where the OPC UA Server gets an Event from another OPC UA Server, each Server
 * applies its own ReceiveTime. That implies that a Client may get the same Event, having the
 * same EventId, from different Servers having different values of the ReceiveTime.
 *
 * The ReceiveTime shall always be returned as value and the Server is not allowed to return a
 * StatusCode for the ReceiveTime indicating an error.
 *
 * @method setReceiveTime
 * @param time {Date} : UTCTime
 */
ConditionSnapshot.prototype.setReceiveTime = function(time) {
    assert(time instanceof Date);
    const self = this;
    return self._set_var("receiveTime", DataType.DateTime, time);
};

/**
 * (as per OPCUA 1.0.3 part 5)

 * Time provides the time the Event occurred. This value is set as close to the event generator as
 * possible. It often comes from the underlying system or device. Once set, intermediate OPC UA
 * Servers shall not alter the value.
 *
 * @method setTime
 * @param time {Date}
 */
ConditionSnapshot.prototype.setTime = function(time) {
    assert(time instanceof Date);
    const self = this;
    return self._set_var("time", DataType.DateTime, time);
};

/**
 * LocalTime is a structure containing the Offset and the DaylightSavingInOffset flag. The Offset
 * specifies the time difference (in minutes) between the Time Property and the time at the location
 * in which the event was issued. If DaylightSavingInOffset is TRUE, then Standard/Daylight
 * savings time (DST) at the originating location is in effect and Offset includes the DST c orrection.
 * If FALSE then the Offset does not include DST correction and DST may or may not have been
 * in effect.
 * @method setLocalTime
 * @param localTime {TimeZone}
 */
ConditionSnapshot.prototype.setLocalTime = function(localTime) {
    assert(localTime instanceof TimeZone);
    const self = this;
    return self._set_var("localTime", DataType.ExtensionObject, new TimeZone(localTime));
};
// read only !
ConditionSnapshot.prototype.getSourceName = function() {
    return this._get_var("sourceName", DataType.LocalizedText);
};

/**
 * @method getSourceNode
 * return {NodeId}
 */
ConditionSnapshot.prototype.getSourceNode = function() {
    return this._get_var("sourceNode", DataType.NodeId);
};

/**
 * @method getEventType
 * return {NodeId}
 */
ConditionSnapshot.prototype.getEventType = function() {
    return this._get_var("eventType", DataType.NodeId);
};

/**
 * @method getMessage
 * return {LocalizedText}
 */
ConditionSnapshot.prototype.getMessage = function() {
    return this._get_var("message", DataType.LocalizedText);
};

ConditionSnapshot.prototype.isCurrentBranch = function() {
    return this._get_var("branchId") === NodeId.NullNodeId;
};

/**
 * @class ConditionSnapshot
 * @param varName
 * @param value
 * @private
 */
ConditionSnapshot.prototype._set_twoStateVariable = function(varName, value) {
    value = !!value;
    const self = this;

    const hrKey = ConditionSnapshot.normalizeName(varName);
    const idKey = ConditionSnapshot.normalizeName(varName) + ".id";

    const variant = new Variant({ dataType: DataType.Boolean, value: value });
    self._map[idKey] = variant;

    // also change varName with human readable text
    const twoStateNode = self._node_index[hrKey];
    if (!twoStateNode) {
        throw new Error("Cannot find twoState Varaible with name " + varName);
    }
    if (!(twoStateNode instanceof UATwoStateVariable)) {
        throw new Error("Cannot find twoState Varaible with name " + varName + " " + twoStateNode);
    }

    const txt = value ? twoStateNode._trueState : twoStateNode._falseState;

    const hrValue = new Variant({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText(txt)
    });
    self._map[hrKey] = hrValue;

    const node = self._node_index[idKey];

    // also change ConditionNode if we are on currentBranch
    if (self.isCurrentBranch()) {
        assert(twoStateNode instanceof UATwoStateVariable);
        twoStateNode.setValue(value);
        //xx console.log("Is current branch", twoStateNode.toString(),variant.toString());
        //xx console.log("  = ",twoStateNode.getValue());
    }
    self.emit("value_changed", node, variant);
};

ConditionSnapshot.prototype._get_twoStateVariable = function(varName) {
    const self = this;
    const key = ConditionSnapshot.normalizeName(varName) + ".id";
    const variant = self._map[key];

    // istanbul ignore next
    if (!variant) {
        throw new Error("Cannot find TwoStateVariable with name " + varName);
    }
    return variant.value;
};
exports.ConditionSnapshot = ConditionSnapshot;

/**
 * @class BaseEventType
 * @class UAObject
 * @constructor
 */
function BaseEventType() {}
util.inherits(BaseEventType, UAObject);

/**
 * @method setSourceName
 * @param name
 */
BaseEventType.prototype.setSourceName = function(name) {
    assert(typeof name === "string");
    const self = this;
    self.sourceName.setValueFromSource(
        new Variant({
            dataType: DataType.String,
            value: name
        })
    );
};

/**
 * @method setSourceNode
 * @param node {NodeId|UAObject}
 */
BaseEventType.prototype.setSourceNode = function(node) {
    const self = this;
    self.sourceNode.setValueFromSource(
        new Variant({
            dataType: DataType.NodeId,
            value: node.nodeId ? node.nodeId : node
        })
    );
};

/**
 * @class UAConditionBase
 * @constructor
 * @extends BaseEventType
 */
function UAConditionBase() {}
util.inherits(UAConditionBase, BaseEventType);
UAConditionBase.prototype.nodeClass = NodeClass.Object;
UAConditionBase.typeDefinition = resolveNodeId("ConditionType");

/**
 * @method initialize
 * @private
 */
UAConditionBase.prototype.initialize = function() {
    const self = this;
    self._branches = {};
};

/**
 * @method post_initialize
 * @private
 */
UAConditionBase.prototype.post_initialize = function() {
    const self = this;
    assert(!self._branch0);
    self._branch0 = new ConditionSnapshot(self, NodeId.NullNodeId);

    // the condition OPCUA object alway reflects the default branch states
    // so we set a mechanism that automatically keeps self in sync
    // with the default branch.

    // the implication of this convention is that interacting with the condition variable
    // shall be made by using branch0, any value change made
    // using the standard setValueFromSource mechanism will not be work properly.
    self._branch0.on("value_changed", function(node, variant) {
        assert(node instanceof UAVariable);
        node.setValueFromSource(variant);
    });
};

/**
 * @method getBranchCount
 * @return {Number}
 */
UAConditionBase.prototype.getBranchCount = function() {
    const self = this;
    return Object.keys(self._branches).length;
};
UAConditionBase.prototype.getBranches = function() {
    const self = this;
    return Object.keys(self._branches).map(function(x) {
        return self._branches[x];
    });
};
UAConditionBase.prototype.getBranchIds = function() {
    const self = this;
    return self.getBranches().map(function(b) {
        return b.getBranchId();
    });
};
const ec = require("node-opcua-basic-types");
const randomGuid = ec.randomGuid;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;

function _create_new_branch_id() {
    return makeNodeId(randomGuid(), 1);
}

/**
 * @method createBranch
 * @return {ConditionSnapshot}
 */
UAConditionBase.prototype.createBranch = function() {
    const self = this;
    const branchId = _create_new_branch_id();
    const snapshot = new ConditionSnapshot(self, branchId);
    self._branches[branchId.toString()] = snapshot;
    return snapshot;
};
/**
 *  @method deleteBranch
 *  @param branch {ConditionSnapshot}
 */
UAConditionBase.prototype.deleteBranch = function(branch) {
    const self = this;
    const key = branch.getBranchId().toString();
    assert(branch.getBranchId() !== NodeId.NullNodeId, "cannot delete branch zero");
    assert(self._branches.hasOwnProperty(key));
    delete self._branches[key];
    self.emit("branch_deleted", key);
};

const minDate = new Date(1600, 1, 1);

function prepare_date(sourceTimestamp) {
    if (!sourceTimestamp || !sourceTimestamp.value) {
        return minDate;
    }
    assert(sourceTimestamp.value instanceof Date);
    return sourceTimestamp;
}

function _update_sourceTimestamp(dataValue /*, indexRange*/) {
    const self = this;
    //xx console.log("_update_sourceTimestamp = "+self.nodeId.toString().cyan+ " " + self.browseName.toString(), self.sourceTimestamp.nodeId.toString().cyan + " " + dataValue.sourceTimestamp);
    self.sourceTimestamp.setValueFromSource({
        dataType: DataType.DateTime,
        value: dataValue.sourceTimestamp
    });
}
const makeAccessLevel = require("node-opcua-data-model").makeAccessLevel;

function _install_condition_variable_type(node) {
    // from spec 1.03 : 5.3 condition variables
    // However,  a change in their value is considered important and supposed to trigger
    // an Event Notification. These information elements are called ConditionVariables.
    node.sourceTimestamp.accessLevel = makeAccessLevel("CurrentRead");
    node.accessLevel = makeAccessLevel("CurrentRead");

    // from spec 1.03 : 5.3 condition variables
    // a condition VariableType has a sourceTimeStamp exposed property
    // SourceTimestamp indicates the time of the last change of the Value of this ConditionVariable.
    // It shall be the same time that would be returned from the Read Service inside the DataValue
    // structure for the ConditionVariable Value Attribute.

    assert(node.typeDefinitionObj.browseName.toString() === "ConditionVariableType");
    assert(node.sourceTimestamp.browseName.toString() === "SourceTimestamp");
    node.on("value_changed", _update_sourceTimestamp);
}

/**
 * @method getEnabledState
 * @return {Boolean}
 */
UAConditionBase.prototype.getEnabledState = function() {
    const conditionNode = this;
    return conditionNode.enabledState.getValue();
};
/**
 * @method getEnabledStateAsString
 * @return {String}
 */
UAConditionBase.prototype.getEnabledStateAsString = function() {
    const conditionNode = this;
    return conditionNode.enabledState.getValueAsString();
};

UAConditionBase.prototype.evaluateConditionsAfterEnabled = function() {
    assert(this.getEnabledState() === true);
    throw new Error("Unimplemented , please override");
};

/**
 * @method _setEnabledState
 * @param requestedEnabledState {Boolean}
 * @return {StatusCode} StatusCodes.Good if successful or BadConditionAlreadyEnabled/BadConditionAlreadyDisabled
 * @private
 */
UAConditionBase.prototype._setEnabledState = function(requestedEnabledState) {
    const conditionNode = this;

    assert(_.isBoolean(requestedEnabledState));

    const enabledState = conditionNode.getEnabledState();
    if (enabledState && requestedEnabledState) {
        return StatusCodes.BadConditionAlreadyEnabled;
    }
    if (!enabledState && !requestedEnabledState) {
        return StatusCodes.BadConditionAlreadyDisabled;
    }

    conditionNode._branch0.setEnabledState(requestedEnabledState);
    //conditionNode.enabledState.setValue(requestedEnabledState);

    //xx assert(conditionNode.enabledState.id.readValue().value.value === requestedEnabledState,"sanity check 1");
    //xx assert(conditionNode.currentBranch().getEnabledState() === requestedEnabledState,"sanity check 2");

    if (!requestedEnabledState) {
        // as per Spec 1.0.3 part 9:
        //* When the Condition instance enters the Disabled state, the Retain Property of this
        // Condition shall be set to FALSE by the Server to indicate to the Client that the
        // Condition instance is currently not of interest to Clients.
        // TODO : shall we really set retain to false or artificially expose the retain false as false
        //        whist enabled state is false ?
        conditionNode._previousRetainFlag = conditionNode.currentBranch().getRetain();
        conditionNode.currentBranch().setRetain(false);

        // install the mechanism by which all condition values will be return
        // as Null | BadConditionDisabled;
        const statusCode = StatusCodes.BadConditionDisabled;

        // a notification must be send
        conditionNode.raiseConditionEvent(conditionNode.currentBranch(), true);
    } else {
        //* When the Condition instance enters the enabled state, the Condition shall be
        //  evaluated and all of its Properties updated to reflect the current values. If this
        //  evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
        //  then an Event Notification shall be generated for that ConditionBranch.

        conditionNode.evaluateConditionsAfterEnabled();

        // todo evaluate branches
        // conditionNode.evaluateBranches();

        // restore retain flag
        if (conditionNode.hasOwnProperty("_previousRetainFlag")) {
            conditionNode.currentBranch().setRetain(conditionNode._previousRetainFlag);
        }

        // todo send notification for branches with retain = true
        let nb_condition_resent = 0;
        if (conditionNode.currentBranch().getRetain()) {
            nb_condition_resent += conditionNode._resend_conditionEvents();
        }

        if (nb_condition_resent === 0) {
            // a notification must be send
            conditionNode.raiseConditionEvent(conditionNode.currentBranch(), true);
        }
    }
    return StatusCodes.Good;
};

/**
 *
 * @method setEnabledState
 * @param requestedEnabledState {Boolean}
 * @private
 */
UAConditionBase.prototype.setEnabledState = function(requestedEnabledState) {
    return this._setEnabledState(requestedEnabledState);
};

/**
 * @method setReceiveTime
 * @param time {Date}
 */
UAConditionBase.prototype.setReceiveTime = function(time) {
    const self = this;
    return self._branch0.setReceiveTime(time);
};

/**
 * @method setLocalTime
 * @param time {Date}
 */
UAConditionBase.prototype.setLocalTime = function(time) {
    const self = this;
    return self._branch0.setLocalTime(time);
};

/**
 * @method setTime
 * @param time {Date}
 */
UAConditionBase.prototype.setTime = function(time) {
    const self = this;
    return self._branch0.setTime(time);
};

UAConditionBase.prototype._assert_valid = function() {
    const self = this;
    assert(self.receiveTime.readValue().value.dataType === DataType.DateTime);
    assert(self.receiveTime.readValue().value.value instanceof Date);

    assert(self.localTime.readValue().value.dataType === DataType.ExtensionObject);
    assert(self.message.readValue().value.dataType === DataType.LocalizedText);
    assert(self.severity.readValue().value.dataType === DataType.UInt16);

    assert(self.time.readValue().value.dataType === DataType.DateTime);
    assert(self.time.readValue().value.value instanceof Date);

    assert(self.quality.readValue().value.dataType === DataType.StatusCode);
    assert(self.enabledState.readValue().value.dataType === DataType.LocalizedText);
    assert(self.branchId.readValue().value.dataType === DataType.NodeId);
};

const browse_service = require("node-opcua-service-browse");
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;

/**
 * @method conditionOfNode
 * @return {UAObject}
 */
UAConditionBase.prototype.conditionOfNode = function() {
    const refs = this.findReferencesExAsObject("HasCondition", BrowseDirection.Inverse);
    if (refs.length === 0) {
        return null;
    }
    assert(refs.length !== 0, "UAConditionBase must be the condition of some node");
    assert(refs.length === 1, "expecting only one ConditionOf");
    const node = refs[0];
    assert(
        node instanceof UAObject || node instanceof UAVariable,
        "node for which we are the condition shall be an UAObject or UAVariable"
    );
    return node;
};

/**
 * @method raiseConditionEvent
 * Raise a Instance Event
 * (see also UAObject#raiseEvent to raise a transient event)
 * @param branch {ConditionSnapshot}
 */
UAConditionBase.prototype.raiseConditionEvent = function(branch, renewEventId) {
    assert(arguments.length === 2, "expecting 2 arguments");
    if (renewEventId) {
        branch.renewEventId();
    }

    //xx console.log("MMMMMMMM%%%%%%%%%%%%%%%%%%%%% branch  " +  branch.getBranchId().toString() + " eventId = " + branch.getEventId().toString("hex"));

    assert(branch instanceof ConditionSnapshot);
    const self = this;
    self._assert_valid();

    // In fact the event is raised by the object of which we are the condition
    const conditionOfNode = self.conditionOfNode();

    if (conditionOfNode) {
        const eventData = branch._constructEventData();

        self.emit("event", eventData);

        if (conditionOfNode instanceof UAObject) {
            //xx assert(conditionOfNode.eventNotifier === 0x01);
            conditionOfNode._bubble_up_event(eventData);
        } else {
            assert(conditionOfNode instanceof UAVariable);
            // in this case
            const eventOfs = conditionOfNode.getEventSourceOfs();
            assert(eventOfs.length === 1);
            const node = eventOfs[0];
            assert(node instanceof UAObject);
            node._bubble_up_event(eventData);
        }
    }
    //xx console.log("MMMMMMMM%%%%%%%%%%%%%%%%%%%%% branch  " +  branch.getBranchId().toString() + " eventId = " + branch.getEventId().toString("hex"));
};

/**
 * @class ConditionInfo
 * @param options  {Object}
 * @param options.message   {String|LocalizedText} the event message
 * @param options.severity  {UInt16} severity
 * @param options.quality   {StatusCode} quality
 * @param options.retain   {Boolean} retain flag
 * @constructor
 */
function ConditionInfo(options) {
    this.severity = null;
    this.quality = null;
    this.message = null;
    this.retain = null;

    if (options.hasOwnProperty("message") && options.message !== null) {
        options.message = LocalizedText.coerce(options.message);
        assert(options.message instanceof LocalizedText);
        this.message = options.message;
    }
    if (options.hasOwnProperty("quality") && options.quality !== null) {
        this.quality = options.quality;
    }
    if (options.hasOwnProperty("severity") && options.severity !== null) {
        assert(_.isNumber(options.severity));
        this.severity = options.severity;
    }
    if (options.hasOwnProperty("retain") && options.retain !== null) {
        assert(_.isBoolean(options.retain));
        this.retain = options.retain;
    }
}
/**
 * @method isDifferentFrom
 * @param otherConditionInfo {ConditionInfo}
 * @return {Boolean}
 */
ConditionInfo.prototype.isDifferentFrom = function(otherConditionInfo) {
    return (
        this.severity !== otherConditionInfo.severity ||
        this.quality !== otherConditionInfo.quality ||
        this.message !== otherConditionInfo.message
    );
};
exports.ConditionInfo = ConditionInfo;

UAConditionBase.defaultSeverity = 250;
/**
 *
 * @method raiseNewCondition
 * @param conditionInfo {ConditionInfo}
 *
 */
UAConditionBase.prototype.raiseNewCondition = function(conditionInfo) {
    const self = this;
    if (!self.getEnabledState()) {
        throw new Error("UAConditionBase#raiseNewCondition Condition is not enabled");
    }

    conditionInfo = conditionInfo || {};

    conditionInfo.severity = conditionInfo.hasOwnProperty("severity")
        ? conditionInfo.severity
        : UAConditionBase.defaultSeverity;

    //only valid for ConditionObjects
    // todo check that object is of type ConditionType

    const addressSpace = self.addressSpace;

    const selfConditionType = self.typeDefinitionObj;
    const conditionType = addressSpace.findObjectType("ConditionType");

    assert(selfConditionType.isSupertypeOf(conditionType));

    const branch = self.currentBranch();

    const now = new Date();
    // install the eventTimestamp
    // set the received Time
    branch.setTime(now);
    branch.setReceiveTime(now);
    branch.setLocalTime(
        new TimeZone({
            offset: 0,
            daylightSavingInOffset: false
        })
    );

    if (conditionInfo.hasOwnProperty("message") && conditionInfo.message) {
        branch.setMessage(conditionInfo.message);
    }
    // todo receive time : when the server received the event from the underlying system.
    // self.receiveTime.setValueFromSource();

    if (conditionInfo.hasOwnProperty("severity") && conditionInfo.severity !== null) {
        assert(_.isFinite(conditionInfo.severity));
        branch.setSeverity(conditionInfo.severity);
    }
    if (conditionInfo.hasOwnProperty("quality") && conditionInfo.quality !== null) {
        assert(conditionInfo.quality instanceof StatusCode);
        branch.setQuality(conditionInfo.quality);
    }
    if (conditionInfo.hasOwnProperty("retain") && conditionInfo.retain !== null) {
        assert(_.isBoolean(conditionInfo.retain));
        branch.setRetain(!!conditionInfo.retain);
    }

    self.raiseConditionEvent(branch, true);
};

UAConditionBase.prototype.raiseNewBranchState = function(branch) {
    const self = this;
    self.raiseConditionEvent(branch, true);

    if (branch.getBranchId() !== NodeId.NullNodeId && !branch.getRetain()) {
        //xx console.log(" Deleting not longer needed branch ", branch.getBranchId().toString());
        // branch can be deleted
        self.deleteBranch(branch);
    }
};

function sameBuffer(b1, b2) {
    if (!b1 && !b2) {
        return true;
    }
    if (b1 && !b2) {
        return false;
    }
    if (!b1 && b2) {
        return false;
    }
    assert(b1 instanceof Buffer);
    assert(b2 instanceof Buffer);
    if (b1.length !== b2.length) {
        return false;
    }
    /*
        var bb1 = (Buffer.from(b1)).toString("hex");
        var bb2 = (Buffer.from(b2)).toString("hex");
        return bb1 === bb2;
    */
    const n = b1.length;
    for (let i = 0; i < n; i++) {
        if (b1[i] !== b2[i]) {
            return false;
        }
    }
    return true;
}
UAConditionBase.prototype._findBranchForEventId = function(eventId) {
    const conditionNode = this;
    if (sameBuffer(conditionNode.eventId.readValue().value.value, eventId)) {
        return conditionNode.currentBranch();
    }
    const e = _.filter(conditionNode._branches, function(branch, key) {
        return sameBuffer(branch.getEventId(), eventId);
    });
    if (e.length === 1) {
        return e[0];
    }
    assert(e.length === 0, "cannot have 2 branches with same eventId");
    return null; // not found
};

exports.UAConditionBase = UAConditionBase;

/**
 * @method _raiseAuditConditionCommentEvent
 * @param sourceName {string}
 * @param eventId    {Buffer}
 * @param comment    {LocalizedText}
 * @private
 */
UAConditionBase.prototype._raiseAuditConditionCommentEvent = function(sourceName, eventId, comment) {
    assert(eventId === null || eventId instanceof Buffer);
    assert(comment instanceof LocalizedText);
    const server = this.addressSpace.rootFolder.objects.server;

    const now = new Date();

    //xx if (true || server.isAuditing) {
    // ----------------------------------------------------------------------------------------------------------------
    server.raiseEvent("AuditConditionCommentEventType", {
        // AuditEventType
        /* part 5 -  6.4.3 AuditEventType */
        actionTimeStamp: {
            dataType: "DateTime",
            value: now
        },
        status: {
            dataType: "Boolean",
            value: true
        },

        serverId: {
            dataType: "String",
            value: ""
        },

        // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
        clientAuditEntryId: {
            dataType: "String",
            value: ""
        },

        // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
        // obtained from the UserIdentityToken passed in the ActivateSession call.
        clientUserId: {
            dataType: "String",
            value: ""
        },
        sourceName: {
            dataType: "String",
            value: sourceName
        },

        // AuditUpdateMethodEventType
        methodId: {},
        inputArguments: {},
        // AuditConditionCommentEventType
        eventId: {
            dataType: DataType.ByteString,
            value: eventId
        },
        comment: {
            dataType: DataType.LocalizedText,
            value: comment
        }
    });
    //xx }
};

/**
 * @method currentBranch
 * @return {ConditionSnapshot}
 */
UAConditionBase.prototype.currentBranch = function() {
    return this._branch0;
};

/**
 *
 * Helper method to handle condition methods that takes a branchId and a comment
 * @method with_condition_method$
 * @param inputArguments             {Array<Variant>}
 * @param context                    {Object}
 * @param context.object             {BaseNode}
 * @param callback                   {Function}
 * @param callback.err               {Error|null}
 * @param callback.result            {Object}
 * @param callback.result.statusCode {StatusCode}
 * @param inner_func                 {Function}
 * @param inner_func.eventId         {Buffer|null}
 * @param inner_func.comment         {LocalizedText}
 * @param inner_func.branch          {ConditionSnapshot}
 * @param inner_func.conditionNode   {UAConditionBase}
 *
 * @return {void}
 */
UAConditionBase.with_condition_method = function(inputArguments, context, callback, inner_func) {
    const conditionNode = context.object;

    //xx console.log(inputArguments.map(function(a){return a.toString()}));
    if (!(conditionNode instanceof UAConditionBase)) {
        callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
        return;
    }

    if (!conditionNode.getEnabledState()) {
        callback(null, {
            statusCode: StatusCodes.BadConditionDisabled
        });
        return;
    }

    // inputArguments has 2 arguments
    // EventId  => ByteString    The Identifier of the event to comment
    // Comment  => LocalizedText The Comment to add to the condition
    assert(inputArguments.length === 2);
    assert(inputArguments[0].dataType === DataType.ByteString);
    assert(inputArguments[1].dataType === DataType.LocalizedText);

    const eventId = inputArguments[0].value;
    assert(!eventId || eventId instanceof Buffer);

    const comment = inputArguments[1].value;
    assert(comment instanceof LocalizedText);

    const branch = conditionNode._findBranchForEventId(eventId);
    if (!branch) {
        callback(null, {
            statusCode: StatusCodes.BadEventIdUnknown
        });
        return;
    }
    assert(branch instanceof ConditionSnapshot);

    const statusCode = inner_func(eventId, comment, branch, conditionNode);

    // record also who did the call
    branch.setClientUserId(context.userIdentity || "<unknown client user id>");

    callback(null, {
        statusCode: statusCode
    });
};

UAConditionBase.prototype._resend_conditionEvents = function() {
    // for the time being , only current branch
    const self = this;
    const currentBranch = self.currentBranch();
    if (currentBranch.getRetain()) {
        debugLog(" resending condition event for " + self.browseName.toString());
        self.raiseConditionEvent(currentBranch, false);
        return 1;
    }
    return 0;
};

BaseNode.prototype._conditionRefresh = function(_cache) {
    // visit all notifiers recursively
    _cache = _cache || {};
    const self = this;
    const notifiers = self.getNotifiers();
    const eventSources = self.getEventSources();

    const conditions = this.findReferencesAsObject("HasCondition", true);
    let i;

    for (i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        if (condition instanceof UAConditionBase) {
            condition._resend_conditionEvents();
        }
    }
    const arr = [].concat(notifiers, eventSources);

    for (i = 0; i < arr.length; i++) {
        const notifier = arr[i];
        const key = notifier.nodeId.toString();
        if (!_cache[key]) {
            _cache[key] = notifier;
            if (notifier._conditionRefresh) {
                notifier._conditionRefresh(_cache);
            }
        }
    }
};

function _perform_condition_refresh(addressSpace, inputArguments, context) {
    // --- possible StatusCodes:
    //
    // Bad_SubscriptionIdInvalid  See Part 4 for the description of this result code
    // Bad_RefreshInProgress      See Table 74 for the description of this result code
    // Bad_UserAccessDenied       The Method was not called in the context of the Session
    //                            that owns the Subscription
    //

    // istanbul ignore next
    if (addressSpace._condition_refresh_in_progress) {
        // a refresh operation is already in progress....
        return StatusCodes.BadRefreshInProgress;
    }

    addressSpace._condition_refresh_in_progress = true;

    const server = context.object.addressSpace.rootFolder.objects.server;
    assert(server instanceof UAObject);

    const refreshStartEventType = addressSpace.findEventType("RefreshStartEventType");
    const refreshEndEventType = addressSpace.findEventType("RefreshEndEventType");

    assert(refreshStartEventType instanceof UAObjectType);
    assert(refreshEndEventType instanceof UAObjectType);

    server.raiseEvent(refreshStartEventType, {});
    // todo : resend retained conditions

    // starting from server object ..
    // evaluated all --> hasNotifier/hasEventSource -> node
    server._conditionRefresh();

    server.raiseEvent(refreshEndEventType, {});

    addressSpace._condition_refresh_in_progress = false;

    return StatusCodes.Good;
}

function _add_comment_method(inputArguments, context, callback) {
    //
    // The AddComment Method is used to apply a comment to a specific state of a Condition
    // instance. Normally, the NodeId of the object instance as the ObjectId is passed to the Call
    // Service. However, some Servers do not expose Condition instances in the AddressSpace.
    // Therefore all Servers shall also allow Clients to call the AddComment Method by specifying
    // ConditionId as the ObjectId. The Method cannot be called with an ObjectId of the
    // ConditionType Node.
    // Signature
    //   - EventId EventId identifying a particular Event Notification where a state was reported for a
    //             Condition.
    //   - Comment A localized text to be applied to the Condition.
    //
    // AlwaysGeneratesEvent  AuditConditionCommentEventType
    //
    UAConditionBase.with_condition_method(inputArguments, context, callback, function(
        eventId,
        comment,
        branch,
        conditionNode
    ) {
        assert(inputArguments instanceof Array);
        assert(eventId instanceof Buffer || eventId === null);
        assert(branch instanceof ConditionSnapshot);
        branch.setComment(comment);

        const sourceName = "Method/AddComment";

        conditionNode._raiseAuditConditionCommentEvent(sourceName, eventId, comment);

        // raise new event
        conditionNode.raiseConditionEvent(branch, true);

        /**
         * @event addComment
         * @param  eventId   {Buffer|null}
         * @param  comment   {LocalizedText}
         * @param  branch    {ConditionSnapshot}
         * raised when the  branch has been added a comment
         */
        conditionNode.emit("addComment", eventId, comment, branch);

        return StatusCodes.Good;
    });
}

function _enable_method(inputArguments, context, callback) {
    assert(inputArguments.length === 0);
    const conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }
    const statusCode = conditionNode._setEnabledState(true);
    return callback(null, {
        statusCode: statusCode
    });
}

function _disable_method(inputArguments, context, callback) {
    assert(inputArguments.length === 0);

    const conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {
            statusCode: StatusCodes.BadNodeIdInvalid
        });
    }
    const statusCode = conditionNode._setEnabledState(false);
    return callback(null, {
        statusCode: statusCode
    });
}

/**
 * verify that the subscription id belongs to the session that make the call.
 * @method _check_subscription_id_is_valid
 * @param subscriptionId {Number}
 * @param context {Object}
 * @private
 */
function _check_subscription_id_is_valid(subscriptionId, context) {
    /// todo: return StatusCodes.BadSubscriptionIdInvalid; if subscriptionId doesn't belong to session...
    return StatusCodes.Good;
}

function _condition_refresh_method(inputArguments, context, callback) {
    // arguments : IntegerId SubscriptionId
    assert(inputArguments.length === 1);

    const addressSpace = context.object.addressSpace;
    if (doDebug) {
        debugLog(" ConditionType.ConditionRefresh ! subscriptionId =".red.bgWhite, inputArguments[0].toString());
    }
    const subscriptionId = inputArguments[0].value;

    let statusCode = _check_subscription_id_is_valid(subscriptionId, context);
    if (statusCode !== StatusCodes.Good) {
        return statusCode;
    }

    statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
    return callback(null, {
        statusCode: statusCode
    });
}

function _condition_refresh2_method(inputArguments, context, callback) {
    // arguments : IntegerId SubscriptionId
    // arguments : IntegerId MonitoredItemId
    assert(inputArguments.length === 2);

    const addressSpace = context.object.addressSpace;

    // istanbul ignore next
    if (doDebug) {
        debugLog(" ConditionType.conditionRefresh2 !".cyan.bgWhite);
    }

    //xx var subscriptionId = inputArguments[0].value;
    //xx var monitoredItemId = inputArguments[1].value;

    const statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
    return callback(null, {
        statusCode: statusCode
    });
}

UAConditionBase.install_condition_refresh_handle = function _install_condition_refresh_handle(addressSpace) {
    //
    // install CondititionRefresh
    //
    // NOTE:
    // OPCUA doesn't implement the condition refresh method ! yet
    // .5.7 ConditionRefresh Method
    // ConditionRefresh allows a Client to request a Refresh of all Condition instances that currently
    // are in an interesting state (they have the Retain flag set). This includes previous states of a
    // Condition instance for which the Server maintains Branches. A Client would typically invoke
    // this Method when it initially connects to a Server and following any situations, such as
    // communication disruptions, in which it would require resynchronization with the Server. This
    // Method is only available on the ConditionType or its subtypes. To invoke this Method, the call
    // shall pass the well known MethodId of the Method on the ConditionType and the ObjectId
    // shall be the well known ObjectId of the ConditionType Object.

    const conditionType = addressSpace.findEventType("ConditionType");
    assert(conditionType !== null);

    conditionType.disable.bindMethod(_disable_method);
    conditionType.enable.bindMethod(_enable_method);

    conditionType.conditionRefresh.bindMethod(_condition_refresh_method);

    conditionType.conditionRefresh2.bindMethod(_condition_refresh2_method);

    // those methods can be call on the ConditionType or on the ConditionInstance itself...
    conditionType.addComment.bindMethod(_add_comment_method);
};

/**
 * @method _getCompositeKey
 * @param node {BaseNode}
 * @param key {String}
 * @return {BaseNode}
 * @private
 *
 * @example
 *
 *     var node  = _getComposite(node,"enabledState.id");
 *
 */
function _getCompositeKey(node, key) {
    let cur = node;
    const elements = key.split(".");
    for (let i = 0; i < elements.length; i++) {
        const e = elements[i];

        // istanbul ignore next
        if (!cur.hasOwnProperty(e)) {
            throw new Error(" cannot extract '" + key + "' from " + node.browseName.toString());
        }

        cur = cur[e];
    }
    return cur;
}

/**
 * instantiate a Condition.
 * this will create the unique EventId and will set eventType
 * @method instantiate
 * @param addressSpace
 * @param conditionTypeId          {String|NodeId}  the EventType to instantiate
 * @param options                  {object}
 * @param options.browseName       {String|QualifiedName}
 * @param options.componentOf      {NodeId|UAObject}
 * @param options.conditionOf      {NodeId|UAObject} Mandatory
 * @param options.organizedBy      {NodeId|UAObject} ( only provide componentOf or organizedBy but not both)
 * @param [options.conditionClass =BaseConditionClassType]  {NodeId|UAObject}
 *                                 The condition Class nodeId or object used to set the ConditionClassId and
 *                                 ConditionClassName properties of the condition.
 *
 * @param options.conditionSource  {NodeId|UAObject} the condition source node.
 *                                                   this node must be marked a EventSource.
 *                                                   the conditionSource is used to populate the sourceNode and
 *                                                   sourceName variables defined by BaseEventType
 * @param options.conditionName    {String} the condition Name
 * @param [options.optionals]      [Array<String>]   an Array of optinals fields
 *
 * @param data         {object}         a object containing the value to set
 * @param data.eventId {String|NodeId}  the EventType Identifier to instantiate (type cannot be abstract)

 * @return node        {UAConditionBase}
 */
UAConditionBase.instantiate = function(addressSpace, conditionTypeId, options, data) {
    /* eslint max-statements: ["error", 100] */

    const conditionType = addressSpace.findEventType(conditionTypeId);

    /* istanbul ignore next */
    if (!conditionType) {
        throw new Error(" cannot find Condition Type for " + conditionTypeId);
    }

    // reminder : abstract event type cannot be instantiated directly !
    assert(!conditionType.isAbstract);

    const baseConditionEventType = addressSpace.findEventType("ConditionType");
    /* istanbul ignore next */
    if (!baseConditionEventType) {
        throw new Error("cannot find  ConditionType");
    }

    assert(conditionType.isSupertypeOf(baseConditionEventType));

    // assert(_.isString(options.browseName));
    options.browseName = options.browseName || "??? instantiateCondition - missing browseName";

    options.optionals = options.optionals || [];

    //
    options.optionals.push("Comment.SourceTimestamp");
    options.optionals.push("EnabledState.TrueState");
    options.optionals.push("EnabledState.TrueState");
    options.optionals.push("EnabledState.FalseState");

    options.optionals.push("EnabledState.TransitionTime");
    options.optionals.push("EnabledState.EffectiveTransitionTime");
    options.optionals.push("EnabledState.EffectiveDisplayName");

    const conditionNode = conditionType.instantiate(options);
    Object.setPrototypeOf(conditionNode, UAConditionBase.prototype);
    conditionNode.initialize();

    assert(
        options.hasOwnProperty("conditionSource"),
        "must specify a condition source either as null or as a UAObject"
    );
    if (!options.conditionOf) {
        options.conditionOf = options.conditionSource;
    }
    if (options.conditionOf) {
        assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
        options.conditionOf = addressSpace._coerceNode(options.conditionOf);

        // HasCondition References can be used in the Type definition of an Object or a Variable.
        assert(options.conditionOf instanceof UAObject || options.conditionOf instanceof UAVariable);

        conditionNode.addReference({
            referenceType: "HasCondition",
            isForward: false,
            nodeId: options.conditionOf
        });
        assert(conditionNode.conditionOfNode().nodeId === options.conditionOf.nodeId);
    }

    /**
     * dataType is DataType.NodeId
     * @property eventType
     * @type {UAVariableType}
     *
     */
    // the constant property of this condition
    conditionNode.eventType.setValueFromSource({
        dataType: DataType.NodeId,
        value: conditionType.nodeId
    });

    data = data || {};
    // install initial branch ID (null NodeId);
    /**
     * dataType is DataType.NodeId
     * @property branchId
     * @type {UAVariableType}
     *
     */
    conditionNode.branchId.setValueFromSource({
        dataType: DataType.NodeId,
        value: NodeId.NullNodeId
    });

    // install 'Comment' condition variable
    /**
     * dataType is DataType.LocalizedText
     * @property comment
     * @type {UAVariableType}
     *
     */
    _install_condition_variable_type(conditionNode.comment);

    // install 'Quality' condition variable
    /**
     * dataType is DataType.StatusCode
     * @property quality
     * @type {UAVariableType}
     *
     */
    _install_condition_variable_type(conditionNode.quality);
    //xx conditionNode.quality.setValueFromSource({dataType: DataType.StatusCode,value: StatusCodes.Good });

    // install 'LastSeverity' condition variable
    /**
     * dataType is DataType.StatusCode
     * @property lastSeverity
     * @type {UAVariableType}
     *
     */
    _install_condition_variable_type(conditionNode.lastSeverity);
    //xx conditionNode.severity.setValueFromSource({dataType: DataType.UInt16,value: 0 });
    //xx conditionNode.lastSeverity.setValueFromSource({dataType: DataType.UInt16,value: 0 });

    // install  'EnabledState' TwoStateVariable
    /**
     *  @property enabledState
     *  @type {UATwoStateVariable}
     */
    // -------------- fixing missing EnabledState.EffectiveDisplayName
    if (!conditionNode.enabledState.effectiveDisplayName) {
        addressSpace.addVariable({
            browseName: "EffectiveDisplayName",
            dataType: "LocalizedText",
            propertyOf: conditionNode.enabledState
        });
    }
    AddressSpace._install_TwoStateVariable_machinery(conditionNode.enabledState, {
        trueState: "Enabled",
        falseState: "Disabled"
    });
    assert(conditionNode.enabledState._trueState === "Enabled");
    assert(conditionNode.enabledState._falseState === "Disabled");

    // installing sourceName and sourceNode
    conditionNode.enabledState.setValue(true);

    // set properties to in initial values
    Object.keys(data).forEach(function(key) {
        const varNode = _getCompositeKey(conditionNode, key);
        assert(varNode instanceof UAVariable);

        const variant = new Variant(data[key]);

        // check that Variant DataType is compatible with the UAVariable dataType
        //xx var nodeDataType = addressSpace.findNode(varNode.dataType).browseName;

        /* istanbul ignore next */
        if (!varNode._validate_DataType(variant.dataType)) {
            throw new Error(" Invalid variant dataType " + variant + " " + varNode.browseName.toString());
        }

        const value = new Variant(data[key]);

        varNode.setValueFromSource(value);
    });

    // bind condition methods -
    /**
     *  @property enable
     *  @type {UAMethod}
     */
    conditionNode.enable.bindMethod(_enable_method);

    /**
     *  @property disable
     *  @type {UAMethod}
     */
    conditionNode.disable.bindMethod(_disable_method);

    // bind condition methods - AddComment
    /**
     *  @property addComment
     *  @type {UAMethod}
     */
    conditionNode.addComment.bindMethod(_add_comment_method);

    assert(conditionNode instanceof UAConditionBase);

    // ConditionSource => cf SourceNode
    //  As per spec OPCUA 1.03 part 9 page 54:
    //    The ConditionType inherits all Properties of the BaseEventType. Their semantic is defined in
    //    Part 5. SourceNode identifies the ConditionSource.
    //    The SourceNode is the Node which the condition is associated with, it may be the same as the
    //    InputNode for an alarm, but it may be a separate node. For example a motor, which is a
    //    variable with a value that is an RPM, may be the ConditionSource for Conditions that are
    //    related to the motor as well as a temperature sensor associated with the motor. In the former
    //    the InputNode for the High RPM alarm is the value of the Motor RPM, while in the later the
    //    InputNode of the High Alarm would be the value of the temperature sensor that is associated
    //    with the motor.
    /**
     * dataType is DataType.NodeId
     * @property sourceNode
     * @type {UAVariableType}
     *
     */
    if (options.conditionSource !== null) {
        options.conditionSource = addressSpace._coerceNode(options.conditionSource);
        assert(options.conditionSource instanceof BaseNode);

        const conditionSourceNode = addressSpace.findNode(options.conditionSource.nodeId);

        conditionNode.sourceNode.setValueFromSource({
            dataType: DataType.NodeId,
            value: conditionSourceNode.nodeId
        });

        // conditionSourceNode node must be registered as a EventSource of an other node.
        // As per spec OPCUA 1.03 part 9 page 54:
        //   HasNotifier and HasEventSource References are used to expose the hierarchical organization
        //   of Event notifying Objects and ConditionSources. An Event notifying Object represents
        //   typically an area of Operator responsibility.  The definition of such an area configuration is
        //   outside the scope of this standard. If areas are available they shall be linked together and
        //   with the included ConditionSources using the HasNotifier and the HasEventSource Reference
        //   Types. The Server Object shall be the root of this hierarchy.
        assert(conditionSourceNode.getEventSourceOfs().length >= 1, "conditionSourceNode must be an event source");

        const context = SessionContext.defaultContext;
        // set source Node (defined in UABaseEventType)
        conditionNode.sourceNode.setValueFromSource(
            conditionSourceNode.readAttribute(context, AttributeIds.NodeId).value
        );

        // set source Name (defined in UABaseEventType)
        conditionNode.sourceName.setValueFromSource(
            conditionSourceNode.readAttribute(context, AttributeIds.DisplayName).value
        );
    }

    conditionNode.eventType.setValueFromSource({
        dataType: DataType.NodeId,
        value: conditionType.nodeId
    });
    // as per spec:

    /**
     *
     *  dataType: DataType.NodeId
     *
     *  As per spec OPCUA 1.03 part 9:
     *    ConditionClassId specifies in which domain this Condition is used. It is the NodeId of the
     *    corresponding ConditionClassType. See 5.9 for the definition of ConditionClass and a set of
     *    ConditionClasses defined in this standard. When using this Property for filtering, Clients have
     *    to specify all individual ConditionClassType NodeIds. The OfType operator cannot be applied.
     *    BaseConditionClassType is used as class whenever a Condition cannot be assigned to a
     *    more concrete class.
     *
     *                         BaseConditionClassType
     *                                   |
     *                      +---------------------------+----------------------------+
     *                     |                           |                             |
     *            ProcessConditionClassType  MaintenanceConditionClassType  SystemConditionClassType
     *
     *  @property conditionName
     *  @type {UAVariable}
     */
    const baseConditionClassType = addressSpace.findObjectType("ProcessConditionClassType");
    //assert(baseConditionClassType,"Expecting BaseConditionClassType to be in addressSpace");
    let conditionClassId = baseConditionClassType ? baseConditionClassType.nodeId : NodeId.NullNodeId;
    let conditionClassName = baseConditionClassType ? baseConditionClassType.displayName[0] : "";
    if (options.conditionClass) {
        if (_.isString(options.conditionClass)) {
            options.conditionClass = addressSpace.findObjectType(options.conditionClass);
        }
        const conditionClassNode = addressSpace._coerceNode(options.conditionClass);
        if (!conditionClassNode) {
            throw new Error("cannot find condition class " + options.conditionClass.toString());
        }
        conditionClassId = conditionClassNode.nodeId;
        conditionClassName = conditionClassNode.displayName[0];
    }
    conditionNode.conditionClassId.setValueFromSource({
        dataType: DataType.NodeId,
        value: conditionClassId
    });

    // as per spec:
    //  ConditionClassName provides the display name of the ConditionClassType.
    conditionNode.conditionClassName.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText(conditionClassName)
    });

    // as per spec:
    /**
     *
     * dataType: DataType.String
     *
     * As per spec OPCUA 1.03 part 9:
     *   ConditionName identifies the Condition instance that the Event originated from. It can be used
     *   together with the SourceName in a user display to distinguish between different Condition
     *   instances. If a ConditionSource has only one instance of a ConditionType, and the Server has
     *   no instance name, the Server shall supply the ConditionType browse name.
     * @property conditionName
     * @type {UAVariable}
     */
    const conditionName = options.conditionName || "Unset Condition Name";
    assert(_.isString(conditionName));
    conditionNode.conditionName.setValueFromSource({
        dataType: DataType.String,
        value: conditionName
    });

    // set SourceNode and SourceName based on HasCondition node
    const sourceNodes = conditionNode.findReferencesAsObject("HasCondition", false);
    if (sourceNodes.length) {
        assert(sourceNodes.length === 1);
        conditionNode.setSourceNode(sourceNodes[0].nodeId);
        conditionNode.setSourceName(sourceNodes[0].browseName.toString());
    }

    conditionNode.post_initialize();

    const branch0 = conditionNode.currentBranch();
    branch0.setRetain(false);
    branch0.setComment("Initialized");
    branch0.setQuality(StatusCodes.Good);
    branch0.setSeverity(0);
    branch0.setLocalTime(
        new TimeZone({
            offset: 0,
            daylightSavingInOffset: false
        })
    );
    branch0.setMessage(" ");

    branch0.setReceiveTime(minDate);
    branch0.setTime(minDate);

    // UAConditionBase
    return conditionNode;
};

/*
 As per spec OPCUA 1.03 part 9:

 A Condition’s EnabledState effects the generation of Event Notifications and as such results
 in the following specific behaviour:
 * When the Condition instance enters the Disabled state, the Retain Property of this
 Condition shall be set to FALSE by the Server to indicate to the Client that the
 Condition instance is currently not of interest to Clients.
 * When the Condition instance enters the enabled state, the Condition shall be
 evaluated and all of its Properties updated to reflect the current values. If this
 evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
 then an Event Notification shall be generated for that ConditionBranch.
 * The Server may choose to continue to test for a Condition instance while it is
 Disabled. However, no Event Notifications will be generated while the Condition
 instance is disabled.
 * For any Condition that exists in the AddressSpace the Attributes and the following
 Variables will continue to have valid values even in the Disabled state; EventId, Event
 Type, Source Node, Source Name, Time, and EnabledState.
 Other properties may no longer provide current valid values.
 All Variables that are no longer provided shall return a status of Bad_ConditionDisabled.
 The Event that reports the Disabled state  should report the properties as NULL or with a status
 of Bad_ConditionDisabled.
 When enabled, changes to the following components shall cause a ConditionType Event Notification:
 - Quality
 - Severity (inherited from BaseEventType)
 - Comment

 // spec :
 // The HasCondition ReferenceType is a concrete ReferenceType and can be used directly. It is
 // a subtype of NonHierarchicalReferences.
 // The semantic of this ReferenceType is to specify the relationship between a ConditionSource
 // and its Conditions. Each ConditionSource shall be the target of a HasEventSource Reference
 // or a sub type of HasEventSource. The AddressSpace organisation that shall be provided for
 // Clients to detect Conditions and ConditionSources is defined in Clause 6. Various examples
 // for the use of this ReferenceType can be found in B.2.
 // HasCondition References can be used in the Type definition of an Object or a Variable. In this
 // case, the SourceNode of this ReferenceType shall be an ObjectType or VariableType Node or
 // one of their InstanceDeclaration Nodes. The TargetNode shall be a Condition instance
 // declaration or a ConditionType. The following rules for instantiation apply:
 //  All HasCondition References used in a Type shall exist in instances of these Types as
 //    well.
 //  If the TargetNode in the Type definition is a ConditionType, the same TargetNode will
 //    be referenced on the instance.
 // HasCondition References may be used solely in the instance space when they are not
 // available in Type definitions. In this case the SourceNode of this ReferenceType shall be an
 // Object, Variable or Method Node. The TargetNode shall be a Condition instance or a
 // ConditionType.

 */
