"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);

require("set-prototype-of");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var assert = require("better-assert");
var _ = require("underscore");

var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var StatusCode = require("lib/datamodel/opcua_status_code").StatusCode;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var UAObject = require("lib/address_space/ua_object").UAObject;
var BaseNode = require("lib/address_space/base_node").BaseNode;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var EventData = require("lib/address_space/address_space_add_event_type").EventData;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var SessionContext = require("lib/server/session_context").SessionContext;

var utils = require("lib/misc/utils");

function _visit(self, node, prefix) {

    var aggregates = node.getAggregates();

    aggregates.forEach(function (aggregate) {

        if (aggregate instanceof UAVariable) {

            var name = aggregate.browseName.toString();
            name = utils.lowerFirstLetter(name);

            var key = prefix +name;
            if (doDebug || true) {
                debugLog("addingkey =", key)
            }
            self._map[key] = aggregate.readValue().value;
            self._node_index[key] = aggregate;
            _visit(self, aggregate, prefix + name + ".");
        }
    });
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
    var self = this;
    EventEmitter.call(this);
    if (condition && branchId) {
        assert(branchId instanceof NodeId);
        //xx self.branchId = branchId;
        self.condition = condition;
        self.eventData = new EventData(condition);
        // a nodeId/Variant map
        _record_condition_state(self, condition);

        self._set_var("branchId", DataType.NodeId,branchId);

    }
}
util.inherits(ConditionSnapshot, EventEmitter);

/**
 *
 * @return {ConditionSnapshot}
 */
ConditionSnapshot.prototype.clone = function () {
    var self = this;
    var clone = new ConditionSnapshot();
    clone.branchId = self.branchId;
    clone.condition = self.condition;
    //xx clone.eventData = new EventData(clone.condition);
    clone._map = _.clone(self._map);
    return clone;
};

var disabledVar = new Variant({ dataType: "StatusCode", value: StatusCodes.BadConditionDisabled});

ConditionSnapshot.prototype._constructEventData = function() {
    var self = this;
    var addressSpace = self.condition.addressSpace;

    var isDisabled = !self.condition.enabledState.getValue() ;
    var eventData = new EventData(self.condition);
    Object.keys(self._map).forEach(function(key){
        var node = self._node_index[key];
        if(isDisabled && !_varTable.hasOwnProperty(key)){
            eventData.setValue(key,node,disabledVar);
        } else {
            eventData.setValue(key,node,self._map[key]);
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
 * @param selectClause
 */
ConditionSnapshot.prototype.resolveSelectClause = function (selectClause) {
    var self = this;
    return self.eventData.resolveSelectClause(selectClause);
};

/**
 *
 * @param nodeId
 * @param selectClause
 * @return {*}
 */
ConditionSnapshot.prototype.readValue = function (nodeId, selectClause) {
    var self = this;

    var isDisabled = !self.condition.enabledState.getValue();
    if (isDisabled) {
         return disabledVar;
    }

    var key = nodeId.toString();
    var variant = self._map[key];
    if (!variant) {
        // the value is not handled by us .. let's delegate
        // to the eventData helper object
        return self.eventData.readValue(nodeId, selectClause);
    }
    assert(variant instanceof Variant);
    return variant;
};

function normalizeName(str) {
    return str.split(".").map(utils.lowerFirstLetter).join(".");
}
ConditionSnapshot.normalizeName = normalizeName;
var _varTable= {
        "eventId": 1,
        "eventType": 1,
        "SourceNode": 1,
        "sourceName": 1,
        "time": 1,
        "enabledState": 1
    };
ConditionSnapshot.prototype._get_var = function (varName, dataType) {

    var self = this;

    if (!self.condition.enabledState.getValue() && !_varTable.hasOwnProperty(varName)) {
        return disabledVar;
    }

    var key = normalizeName(varName);
    var variant = self._map[key];
    return variant.value;
};


ConditionSnapshot.prototype._set_var = function (varName, dataType, value) {

    var self = this;

    var key = normalizeName(varName);
     // istanbul ignore next
    if (!self._map.hasOwnProperty(key)) {
        if (true || doDebug) {
            debugLog(" cannot find node ".white.bold.bgRed + varName.cyan);
            debugLog("  map=", Object.keys(self._map).join(" "));
        }

    }
    self._map[key] = new Variant({dataType: dataType, value: value});

    if (self._map[key + ".sourceTimestamp"]) {
        self._map[key + ".sourceTimestamp"] = new Variant({dataType: DataType.DateTime, value: new Date()});
    }

    var variant = self._map[key];
    var node = self._node_index[key];
    assert(node instanceof UAVariable);
    self.emit("value_changed", node, variant);

};

/**
 * @method getBrandId
 * @return {NodeId}
 */
ConditionSnapshot.prototype.getBranchId = function () {
    var self = this;
    return self._get_var("branchId", DataType.NodeId);
};

/**
 * @method getEventId
 * @return {ByteString}
 */
ConditionSnapshot.prototype.getEventId = function () {
    var self = this;
    return self._get_var("eventId", DataType.ByteString);
};
/**
 * @return {Boolean}
 */
ConditionSnapshot.prototype.getRetain = function () {
    var self = this;
    return self._get_var("retain", DataType.Boolean);
};

/**
 *
 * @param retainFlag {Boolean}
 */
ConditionSnapshot.prototype.setRetain = function (retainFlag) {
    var self = this;
    retainFlag = !!retainFlag;
    return self._set_var("retain", DataType.Boolean, retainFlag);
};


/**
 *
 */
ConditionSnapshot.prototype.renewEventId = function () {
    var self = this;
    var addressSpace = self.condition.addressSpace;
    // create a new event  Id for this new condition
    var eventId = addressSpace.generateEventId();
    return self._set_var("eventId", DataType.ByteString, eventId.value);
};


/**
 * @return {LocalizedText}
 */
ConditionSnapshot.prototype.getComment = function () {
    var self = this;
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
ConditionSnapshot.prototype.setComment = function (txtMessage) {
    var self = this;
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
 * @param txtMessage {LocalizedText}
 */
ConditionSnapshot.prototype.setMessage = function (txtMessage) {
    var self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    return self._set_var("message", DataType.LocalizedText, txtMessage);
};

/**
 *
 * @param userIdentity {String}
 */
ConditionSnapshot.prototype.setClientUserId = function (userIdentity) {
    var self = this;
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
ConditionSnapshot.prototype.setQuality = function (quality) {
    var self = this;
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
ConditionSnapshot.prototype.getQuality = function () {
    var self = this;
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
ConditionSnapshot.prototype.setSeverity = function (severity) {
    var self = this;
    // record automatically last severity
    var lastSeverity = self.getSeverity();
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
 * @return {UInt16}
 */
ConditionSnapshot.prototype.getSeverity = function () {
    var self = this;
    return self._get_var("severity", DataType.UInt16);
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
ConditionSnapshot.prototype.setLastSeverity = function (severity) {
    var self = this;
    severity = +severity;
    return self._set_var("lastSeverity", DataType.UInt16, severity);
};
/**
 * @method getLastSeverity
 * @return {UInt16}
 */
ConditionSnapshot.prototype.getLastSeverity = function () {
    var self = this;
    var value = self._get_var("lastSeverity", DataType.UInt16);
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
ConditionSnapshot.prototype.setReceiveTime = function (time) {
    assert(time instanceof Date);
    var self = this;
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
ConditionSnapshot.prototype.setTime = function (time) {
    assert(time instanceof Date);
    var self = this;
    return self._set_var("time", DataType.DateTime, time);
};

var TimeZone;
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
ConditionSnapshot.prototype.setLocalTime = function (localTime) {
    TimeZone = TimeZone || require("lib/datamodel/time_zone").TimeZone;
    assert(localTime instanceof TimeZone);
    var self = this;
    return self._set_var("localTime", DataType.ExtensionObject, new TimeZone(localTime));
};
// read only !
ConditionSnapshot.prototype.getSourceName = function () {
    return this._get_var("sourceName", DataType.LocalizedText);
};


/**
 * @method getSourceNode
 * return {NodeId}
 */
ConditionSnapshot.prototype.getSourceNode = function () {
    return this._get_var("sourceNode", DataType.NodeId);
};

/**
 * @method getEventType
 * return {NodeId}
 */
ConditionSnapshot.prototype.getEventType = function () {
    return this._get_var("eventType", DataType.NodeId);
};

/**
 * @method getMessage
 * return {LocalizedText}
 */
ConditionSnapshot.prototype.getMessage = function () {
    return this._get_var("message", DataType.LocalizedText);
};

exports.ConditionSnapshot = ConditionSnapshot;


/**
 * @class BaseEventType
 * @class UAObject
 * @constructor
 */
function BaseEventType() {

}
util.inherits(BaseEventType, UAObject);


/**
 * @method setSourceName
 * @param name
 */
BaseEventType.prototype.setSourceName = function (name) {

    assert(typeof(name) === "string");
    var self = this;
    self.sourceName.setValueFromSource(new Variant({
        dataType: DataType.String,
        value: name
    }));
};

/**
 * @method setSourceNode
 * @param node {NodeId|UAObject}
 */
BaseEventType.prototype.setSourceNode = function (node) {
    var self = this;
    self.sourceNode.setValueFromSource(new Variant({
        dataType: DataType.NodeId,
        value: node.nodeId ? node.nodeId : node
    }));

};


/**
 * @class UAConditionBase
 * @constructor
 * @extends BaseEventType
 */
function UAConditionBase() {

}
util.inherits(UAConditionBase, BaseEventType);
UAConditionBase.prototype.nodeClass = NodeClass.Object;
UAConditionBase.typeDefinition = resolveNodeId("ConditionType");

/**
 * @method initialize
 * @private
 */
UAConditionBase.prototype.initialize = function () {
    var self = this;
    self._branches = {};
};

/**
 * @method post_initialize
 * @private
 */
UAConditionBase.prototype.post_initialize = function () {

    var self = this;
    assert(!self._branch0);
    self._branch0 = new ConditionSnapshot(self, NodeId.NullNodeId);

    // the condition OPCUA object alway reflect the default branch states
    // so we set a mechanism that automatically keeps self in sync
    // with the default branch.
    self._branch0.on("value_changed", function (node, variant) {
        assert(node instanceof UAVariable);
        node.setValueFromSource(variant);
    });
};

/**
 * @method getBranchCount
 * @return {Number}
 */
UAConditionBase.prototype.getBranchCount = function () {
    var self = this;
    return Object.keys(self._branches).length;
};

var ec = require("lib/misc/encode_decode");
var randomGuid = ec.randomGuid;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;

function _create_new_branch_id() {
    return makeNodeId(randomGuid(), 1);
}

/**
 * @method createBranch
 * @returns {ConditionSnapshot}
 */
UAConditionBase.prototype.createBranch = function () {
    var self = this;
    var branchId = _create_new_branch_id();
    var snapshot = new ConditionSnapshot(self, branchId);
    self._branches[branchId.toString()] = snapshot;
    return snapshot;
};
/**
 *  @method deleteBranch
 *  @param branch {ConditionSnapshot}
 */
UAConditionBase.prototype.deleteBranch = function (branch) {
    var self = this;
    var key = branch.getBranchId().toString();
    assert(self._branches.hasOwnProperty(key));
    delete self._branches[key];
};


var minDate = new Date(1600, 1, 1);

function prepare_date(sourceTimestamp) {
    if (!sourceTimestamp || !sourceTimestamp.value) {
        return minDate;
    }
    assert(sourceTimestamp.value instanceof Date);
    return sourceTimestamp;
}

function _update_sourceTimestamp(dataValue/*, indexRange*/) {

    var self = this;
    //xx console.log("_update_sourceTimestamp = "+self.nodeId.toString().cyan+ " " + self.browseName.toString(), self.sourceTimestamp.nodeId.toString().cyan + " " + dataValue.sourceTimestamp);
    self.sourceTimestamp.setValueFromSource({
        dataType: DataType.DateTime,
        value: dataValue.sourceTimestamp
    });

}
var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;

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
    assert(node.sourceTimestamp.browseName.toString() == "SourceTimestamp");
    node.on("value_changed", _update_sourceTimestamp);

}

/**
 * @method getEnabledState
 * @return {Boolean}
 */
UAConditionBase.prototype.getEnabledState = function () {
    var conditionNode = this;
    return !!conditionNode.enabledState.id.readValue().value.value;
};

/**
 * @method _setEnabledState
 * @param requestedEnableState {Boolean}
 * @returns {StatusCode} StatusCodes.Good if successfull or BadConditionAlreadyEnabled/BadConditionAlreadyDisabled
 * @private
 */
UAConditionBase.prototype._setEnabledState = function (requestedEnableState) {

    assert(_.isBoolean(requestedEnableState));

    var conditionNode = this;
    var enabledState = conditionNode.getEnabledState();
    if (enabledState && requestedEnableState) {
        return StatusCodes.BadConditionAlreadyEnabled;
    }
    if (!enabledState && !requestedEnableState) {
        return StatusCodes.BadConditionAlreadyDisabled;
    }
    conditionNode.enabledState.setValue(requestedEnableState);

    if (!requestedEnableState) {
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
        var statusCode = StatusCodes.BadConditionDisabled;


        // a notification must be send
        conditionNode.raiseConditionEvent(conditionNode.currentBranch());


    } else {
        //* When the Condition instance enters the enabled state, the Condition shall be
        //  evaluated and all of its Properties updated to reflect the current values. If this
        //  evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
        //  then an Event Notification shall be generated for that ConditionBranch.
        // todo evaluate branches

        // restore retain flag
        if (conditionNode.hasOwnProperty("_previousRetainFlag")) {
            conditionNode.currentBranch().setRetain(conditionNode._previousRetainFlag);
        }

        // todo send notification for branches with retain = true
        if (conditionNode.currentBranch().getRetain()) {
            conditionNode._resend_conditionEvents();
        }

        // a notification must be send
        conditionNode.raiseConditionEvent(conditionNode.currentBranch());

    }
    return StatusCodes.Good;
};

/**
 * @method setReceiveTime
 * @param time {Date}
 */
UAConditionBase.prototype.setReceiveTime = function (time) {
    var self = this;
    return self._branch0.setReceiveTime(time);
};

/**
 * @method setLocalTime
 * @param time {Date}
 */
UAConditionBase.prototype.setLocalTime = function (time) {
    var self = this;
    return self._branch0.setLocalTime(time);
};

/**
 * @method setTime
 * @param time {Date}
 */
UAConditionBase.prototype.setTime = function (time) {
    var self = this;
    return self._branch0.setTime(time);
};

UAConditionBase.prototype._assert_valid = function () {

    var self = this;
    assert(self.receiveTime.readValue().value.dataType == DataType.DateTime);
    assert(self.receiveTime.readValue().value.value instanceof Date);

    assert(self.localTime.readValue().value.dataType == DataType.ExtensionObject);
    assert(self.message.readValue().value.dataType == DataType.LocalizedText);
    assert(self.severity.readValue().value.dataType == DataType.UInt16);

    assert(self.time.readValue().value.dataType == DataType.DateTime);
    assert(self.time.readValue().value.value instanceof Date);

    assert(self.quality.readValue().value.dataType == DataType.StatusCode);
    assert(self.enabledState.readValue().value.dataType == DataType.LocalizedText);
    assert(self.branchId.readValue().value.dataType == DataType.NodeId);
};


var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

/**
 * @method conditionOfNode
 * @return {UAObject}
 */
UAConditionBase.prototype.conditionOfNode = function() {
    var refs = this.findReferencesExAsObject("HasCondition",BrowseDirection.Inverse);
    if(refs.length ==0) {
        return null;
    }
    assert(refs.length != 0,"UAConditionBase must be the condition of some node");
    assert(refs.length === 1,"expecting only one ConditionOf");
    var node = refs[0];
    assert(node instanceof UAObject || node instanceof UAVariable,"node for which we are the condition shall be an UAObject or UAVariable");
    return node;
};

/**
 * @method raiseConditionEvent
 * Raise a Instance Event
 * (see also UAObject#raiseEvent to raise a transient event)
 * @param branch {ConditionSnapshot}
 */
UAConditionBase.prototype.raiseConditionEvent = function (branch) {

    assert(branch instanceof ConditionSnapshot);
    var self = this;
    self._assert_valid();

    // In fact he event is raised by the object of which we are the condition
    var conditionOfNode = self.conditionOfNode();

    if (conditionOfNode) {
        var eventData = branch._constructEventData();
        if (conditionOfNode instanceof UAObject) {
            //xx assert(conditionOfNode.eventNotifier === 0x01);
            conditionOfNode._bubble_up_event(eventData);
        } else {
            assert(conditionOfNode instanceof UAVariable);
            // in this case
            var eventOfs =conditionOfNode.getEventSourceOfs();
            assert(eventOfs.length === 1);
            var node  = eventOfs[0];
            assert(node instanceof UAObject);
            node._bubble_up_event(eventData);
        }
    }
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
function ConditionInfo(options){
    this.severity = null;
    this.quality  = null;
    this.message  = null;
    this.retain   = null;

    if (options.hasOwnProperty("message") && options.message !=null) {
        options.message = LocalizedText.coerce(options.message);
        assert(options.message instanceof LocalizedText);
        this.message  = options.message;
    }
    if (options.hasOwnProperty("quality")  && options.quality !=null) {
        this.quality  = options.quality;
    }
    if (options.hasOwnProperty("severity")  && options.severity !=null) {
        assert(_.isNumber(options.severity));
        this.severity  = options.severity;
    }
    if (options.hasOwnProperty("retain")  && options.retain !=null) {
        assert(_.isBoolean(options.retain));
        this.retain  = options.retain;
    }

}
/**
 * @method isDifferentFrom
 * @param otherConditionInfo {ConditionInfo}
 * @return {Boolean}
 */
ConditionInfo.prototype.isDifferentFrom = function(otherConditionInfo)
{
    return this.severity != otherConditionInfo.severity  ||
        this.quality  != otherConditionInfo.quality ||
        this.message  != otherConditionInfo.message  ;

};
exports.ConditionInfo = ConditionInfo;

UAConditionBase.defaultSeverity = 250;
/**
 *
 * @method raiseNewCondition
 * @param conditionInfo {ConditionInfo}
 *
 */
UAConditionBase.prototype.raiseNewCondition = function (conditionInfo) {

    TimeZone = TimeZone || require("lib/datamodel/time_zone").TimeZone;
    conditionInfo = conditionInfo || {};

    conditionInfo.severity = conditionInfo.hasOwnProperty("severity") ? conditionInfo.severity : UAConditionBase.defaultSeverity;

    //only valid for ConditionObjects
    // todo check that object is of type ConditionType

    var self = this;
    var addressSpace = self.addressSpace;

    var selfConditionType = self.typeDefinitionObj;
    var conditionType = addressSpace.findObjectType("ConditionType");

    assert(selfConditionType.isSupertypeOf(conditionType));

    var branch = self.currentBranch();

    // install the eventTimestamp
    // set the received Time
    branch.setTime(new Date());
    branch.setReceiveTime(new Date());
    branch.setLocalTime(new TimeZone({offset: 0, daylightSavingInOffset: false}));

    if (conditionInfo.hasOwnProperty("message") && conditionInfo.message) {
        branch.setMessage(conditionInfo.message);
    }
    // todo receive time : when the server received the event from the underlying system.
    // self.receiveTime.setValueFromSource();

    if (conditionInfo.hasOwnProperty("severity") && conditionInfo.severity != null) {
        branch.setSeverity(conditionInfo.severity);
    }
    if (conditionInfo.hasOwnProperty("quality") && conditionInfo.quality != null) {
        branch.setQuality(conditionInfo.quality);
    }
    if (conditionInfo.hasOwnProperty("retain") && conditionInfo.retain != null) {
        branch.setRetain(!!conditionInfo.retain);
    }

    branch.renewEventId();
    self.raiseConditionEvent(branch);
};

UAConditionBase.prototype.raiseNewBranchState = function (branch) {
    var self = this;
    branch.renewEventId();
    self.raiseConditionEvent(branch);

    if (branch.getBranchId() !== NodeId.NullNodeId && !branch.getRetain()) {
        console.log(" Deleting not longer needed branch ", branch.getBranchId().toString());
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
    if (b1.length != b2.length) {
        return false;
    }
/*
    var bb1 = (Buffer.from(b1)).toString("hex");
    var bb2 = (Buffer.from(b2)).toString("hex");
    return bb1 == bb2;
*/
    var n = b1.length;
    for (var i = 0; i < n; i++) {
        if (b1[i] != b2[i]) {
            return false;
        }
    }
    return true;
}
UAConditionBase.prototype._findBranchForEventId = function (eventId) {
    var conditionNode = this;
    if (sameBuffer(conditionNode.eventId.readValue().value.value, eventId)) {
        return conditionNode.currentBranch();
    }
    var e = _.filter(conditionNode._branches,function(branch,key){
        return sameBuffer(branch.getEventId(),eventId);
    });
    if (e.length ==1 ) {
        return e[0];
    }
    assert(e.length === 0,"cannot have 2 branches with same eventId");
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
UAConditionBase.prototype._raiseAuditConditionCommentEvent = function (sourceName, eventId, comment) {

    assert(eventId == null || eventId instanceof Buffer);
    assert(comment instanceof LocalizedText);
    var server = this.addressSpace.rootFolder.objects.server;

    var now = new Date();

    //xx if (true || server.isAuditing) {
        // ----------------------------------------------------------------------------------------------------------------
        server.raiseEvent("AuditConditionCommentEventType", {
            // AuditEventType
            /* part 5 -  6.4.3 AuditEventType */
            actionTimeStamp:    {dataType: "DateTime", value: now},
            status:             {dataType: "Boolean", value: true},

            serverId:           {dataType: "String", value: ""},

            // ClientAuditEntryId contains the human-readable AuditEntryId defined in Part 3.
            clientAuditEntryId: {dataType: "String", value: ""},

            // The ClientUserId identifies the user of the client requesting an action. The ClientUserId can be
            // obtained from the UserIdentityToken passed in the ActivateSession call.
            clientUserId:       {dataType: "String", value: "" },
            sourceName:         {dataType: "String", value: sourceName},

            // AuditUpdateMethodEventType
            methodId: {},
            inputArguments: {},
            // AuditConditionCommentEventType
            eventId: { dataType: DataType.ByteString, value: eventId },
            comment: { dataType: DataType.LocalizedText, value: comment }
        });
    //xx }
};


/**
 * @method currentBranch
 * @returns {ConditionSnapshot}
 */
UAConditionBase.prototype.currentBranch = function () {
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
UAConditionBase.with_condition_method = function (inputArguments, context, callback, inner_func) {

    var conditionNode = context.object;

    //xx console.log(inputArguments.map(function(a){return a.toString()}));
    if (!(conditionNode instanceof UAConditionBase)) {
        callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
        return;
    }

    if (!conditionNode.getEnabledState()) {
        callback(null, {statusCode: StatusCodes.BadConditionDisabled});
        return;
    }

    // inputArguments has 2 arguments
    // EventId  => ByteString    The Identifier of the event to comment
    // Comment  => LocalizedText The Comment to add to the condition
    assert(inputArguments.length === 2);
    assert(inputArguments[0].dataType == DataType.ByteString);
    assert(inputArguments[1].dataType == DataType.LocalizedText);

    var eventId = inputArguments[0].value;
    assert(!eventId || eventId instanceof Buffer);

    var comment = inputArguments[1].value;
    assert(comment instanceof LocalizedText);

    var branch = conditionNode._findBranchForEventId(eventId);
    if (!branch) {
        callback(null, {statusCode: StatusCodes.BadEventIdUnknown});
        return;
    }
    assert(branch instanceof ConditionSnapshot);

    var statusCode = inner_func(eventId, comment, branch, conditionNode);

    // record also who did the call
    branch.setClientUserId(context.userIdentity || "<unknown client user id>");

    callback(null, {statusCode: statusCode});

};

UAConditionBase.prototype._resend_conditionEvents = function () {

    // for the time being , only current branch
    var self = this;
    var currentBranch = self.currentBranch();
    if (currentBranch.getRetain()) {

        debugLog(" resending condition event for " + self.browseName.toString());

        self.raiseConditionEvent(currentBranch);
    }
};

BaseNode.prototype._conditionRefresh = function (_cache) {

    // visit all notifiers recursively
    _cache = _cache || {};
    var self = this;
    var notifiers = self.getNotifiers();
    var eventSources = self.getEventSources();

    var conditions = this.findReferencesAsObject("HasCondition", true);
    var i;

    for ( i = 0; i < conditions.length; i++) {
        var condition = conditions[i];
        if (condition instanceof UAConditionBase) {
            condition._resend_conditionEvents();
        }
    }
    var arr = [].concat(notifiers, eventSources);

    for ( i = 0; i < arr.length; i++) {
        var notifier = arr[i];
        var key = notifier.nodeId.toString();
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

    var server = context.object.addressSpace.rootFolder.objects.server;
    assert(server instanceof UAObject);

    var refreshStartEventType = addressSpace.findEventType("RefreshStartEventType");
    var refreshEndEventType = addressSpace.findEventType("RefreshEndEventType");

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
    UAConditionBase.with_condition_method(inputArguments, context, callback, function (eventId, comment, branch, conditionNode) {

        assert(inputArguments instanceof Array);
        assert(eventId instanceof Buffer|| eventId === null);
        assert(branch instanceof ConditionSnapshot);
        branch.setComment(comment);

        var sourceName = "Method/AddComment";

        conditionNode._raiseAuditConditionCommentEvent(sourceName, eventId, comment);

        // raise new event
        conditionNode.raiseConditionEvent(branch);


        /**
         * @event addComment
         * @param  eventId   {Buffer|null}
         * @param  comment   {LocalizedText}
         * @param  branch    {ConditionSnapshot}
         * raised when the  branch has been added a comment
         */
        conditionNode.emit("addComment",eventId,comment,branch);


        return StatusCodes.Good;
    });
}


function _enable_method(inputArguments, context, callback) {
    assert(inputArguments.length === 0);
    var conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    }
    var statusCode = conditionNode._setEnabledState(true);
    return callback(null, {statusCode: statusCode});

}

function _disable_method(inputArguments, context, callback) {

    assert(inputArguments.length === 0);

    var conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {statusCode: StatusCodes.BadNodeIdInvalid});
    }
    var statusCode = conditionNode._setEnabledState(false);
    return callback(null, {statusCode: statusCode});
}


/**
 * verify that the subscription id belongs to the session that
 * make the call.
 *
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
    assert(inputArguments.length == 1);

    var addressSpace = context.object.addressSpace;
    if (doDebug) {
        debugLog(" ConditionType.ConditionRefresh ! subscriptionId =".red.bgWhite, inputArguments[0].toString());
    }
    var subscriptionId = inputArguments[0].value;

    var statusCode = _check_subscription_id_is_valid(subscriptionId, context);
    if (statusCode != StatusCodes.Good) {
        return statusCode;
    }

    statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
    return callback(null, {statusCode: statusCode});
}

function _condition_refresh2_method(inputArguments, context, callback) {

    // arguments : IntegerId SubscriptionId
    // arguments : IntegerId MonitoredItemId
    assert(inputArguments.length == 2);

    var addressSpace = context.object.addressSpace;
    assert(context.server instanceof OPCUAServer);

    // istanbul ignore next
    if (doDebug) {
        debugLog(" ConditionType.conditionRefresh2 !".cyan.bgWhite);
    }

    var subscriptionId = inputArguments[0].value;
    var monitoredItemId = inputArguments[1].value;

    var statusCode = _perform_condition_refresh(addressSpace, inputArguments, context);
    return callback(null, {statusCode: statusCode});
}


UAConditionBase.install_condition_refresh_handle = function _install_condition_refresh_handle(addressSpace) {

    var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
    assert(OPCUAServer != null);

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

    var conditionType = addressSpace.findEventType("ConditionType");
    assert(conditionType != null);

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

    var cur = node;
    var elements = key.split(".");
    for (var i = 0; i < elements.length; i++) {
        var e = elements[i];

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
UAConditionBase.instantiate = function (addressSpace,conditionTypeId, options, data) {

    TimeZone = TimeZone || require("lib/datamodel/time_zone").TimeZone;

    var conditionType = addressSpace.findEventType(conditionTypeId);

    /* istanbul ignore next */
    if (!conditionType) {
        throw new Error(" cannot find Condition Type for " + conditionTypeId);
    }

    // reminder : abstract event type cannot be instantiated directly !
    assert(!conditionType.isAbstract);

    var baseConditionEventType = addressSpace.findEventType("ConditionType");
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

    var conditionNode = conditionType.instantiate(options);
    Object.setPrototypeOf(conditionNode, UAConditionBase.prototype);
    conditionNode.initialize();

    assert(options.hasOwnProperty("conditionSource"), "must specify a condition source either as null or as a UAObject");
    if (!options.conditionOf) {
        options.conditionOf = options.conditionSource;
    }
    if (options.conditionOf) {
        assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
        options.conditionOf = addressSpace._coerceNode( options.conditionOf);

        // HasCondition References can be used in the Type definition of an Object or a Variable.
        assert(options.conditionOf instanceof UAObject || options.conditionOf instanceof UAVariable);

        conditionNode.addReference({referenceType: "HasCondition", isForward: false, nodeId: options.conditionOf});
        assert(conditionNode.conditionOfNode().nodeId == options.conditionOf.nodeId);
    }


    /**
     * @property eventType
     * @type {UAVariableType}
     *
     * dataType is DataType.NodeId
     */
    // the constant property of this condition
    conditionNode.eventType.setValueFromSource({dataType: DataType.NodeId, value: conditionType.nodeId});

    data = data || {};
    // install initial branch ID (null NodeId);
    /**
     * @property branchId
     * @type {UAVariableType}
     *
     * dataType is DataType.NodeId
     */
    conditionNode.branchId.setValueFromSource({dataType: DataType.NodeId, value: NodeId.NullNodeId});

    // install 'Comment' condition variable
    /**
     * @property comment
     * @type {UAVariableType}
     *
     * dataType is DataType.LocalizedText
     */
    _install_condition_variable_type(conditionNode.comment);


    // install 'Quality' condition variable
    /**
     * @property quality
     * @type {UAVariableType}
     *
     * dataType is DataType.StatusCode
     */
    _install_condition_variable_type(conditionNode.quality);
    //xx conditionNode.quality.setValueFromSource({dataType: DataType.StatusCode,value: StatusCodes.Good });

    // install 'LastSeverity' condition variable
    /**
     * @property lastSeverity
     * @type {UAVariableType}
     *
     * dataType is DataType.StatusCode
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
    AddressSpace._install_TwoStateVariable_machinery(conditionNode.enabledState,{
        trueState: "Enabled",
        falseState: "Disabled"
    });
    assert(conditionNode.enabledState._trueState == "Enabled");
    assert(conditionNode.enabledState._falseState == "Disabled");

    // installing sourceName and sourceNode
    conditionNode.enabledState.setValue(true);

    // set properties to in initial values
    Object.keys(data).forEach(function (key) {

        var varNode = _getCompositeKey(conditionNode, key);
        assert(varNode instanceof UAVariable);

        var variant = new Variant(data[key]);

        // check that Variant DataType is compatible with the UAVariable dataType
        var nodeDataType = addressSpace.findNode(varNode.dataType).browseName;

        /* istanbul ignore next */
        if (!varNode._validate_DataType(variant.dataType)) {
            throw new Error(" Invalid variant dataType " + variant + " " + varNode.browseName.toString());
        }

        var value = new Variant(data[key]);

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
     * @property sourceNode
     * @type {UAVariableType}
     *
     * dataType is DataType.NodeId
     */

    if (options.conditionSource != null) {

        options.conditionSource = addressSpace._coerceNode(options.conditionSource);
        assert(options.conditionSource instanceof BaseNode);

        var conditionSourceNode = addressSpace.findNode(options.conditionSource.nodeId);

        conditionNode.sourceNode.setValueFromSource({dataType: DataType.NodeId, value: conditionSourceNode.nodeId});

        // conditionSourceNode node must be registered as a EventSource of an other node.
        // As per spec OPCUA 1.03 part 9 page 54:
        //   HasNotifier and HasEventSource References are used to expose the hierarchical organization
        //   of Event notifying Objects and ConditionSources. An Event notifying Object represents
        //   typically an area of Operator responsibility.  The definition of such an area configuration is
        //   outside the scope of this standard. If areas are available they shall be linked together and
        //   with the included ConditionSources using the HasNotifier and the HasEventSource Reference
        //   Types. The Server Object shall be the root of this hierarchy.
        assert(conditionSourceNode.getEventSourceOfs().length >= 1, "conditionSourceNode must be an event source");

        var context = SessionContext.defaultContext;
        // set source Node (defined in UABaseEventType)
        conditionNode.sourceNode.setValueFromSource(conditionSourceNode.readAttribute(context, AttributeIds.NodeId).value);

        // set source Name (defined in UABaseEventType)
        conditionNode.sourceName.setValueFromSource(conditionSourceNode.readAttribute(context, AttributeIds.DisplayName).value);

    }

    conditionNode.eventType.setValueFromSource({dataType: DataType.NodeId, value: conditionType.nodeId});
    // as per spec:

    /**
     *  @property conditionName
     *  @type {UAVariable}
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
     */
    var baseConditionClassType = addressSpace.findObjectType("BaseConditionClassType");
    //assert(baseConditionClassType,"Expecting BaseConditionClassType to be in addressSpace");
    var conditionClassId = baseConditionClassType  ? baseConditionClassType.nodeId : NodeId.NullNodeId;
    var conditionClassName = baseConditionClassType ? baseConditionClassType.displayName[0] : "";
    if (options.conditionClass) {
        if (_.isString(options.conditionClass)) {
            options.conditionClass = addressSpace.findObjectType(options.conditionClass);
        }
        var conditionClassNode = addressSpace._coerceNode(options.conditionClass);
        if (!conditionClassNode) {
            throw new Error("cannot find condition class " + options.conditionClass.toString());
        }
        conditionClassId =conditionClassNode.nodeId;
        conditionClassName = conditionClassNode.displayName[0];

    }
    conditionNode.conditionClassId.setValueFromSource({dataType: DataType.NodeId, value: conditionClassId});

    // as per spec:
    //  ConditionClassName provides the display name of the ConditionClassType.
    conditionNode.conditionClassName.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: coerceLocalizedText(conditionClassName)
    });


    // as per spec:
    /**
     * @property conditionName
     * @type {UAVariable}
     *
     * dataType: DataType.String
     *
     * As per spec OPCUA 1.03 part 9:
     *   ConditionName identifies the Condition instance that the Event originated from. It can be used
     *   together with the SourceName in a user display to distinguish between different Condition
     *   instances. If a ConditionSource has only one instance of a ConditionType, and the Server has
     *   no instance name, the Server shall supply the ConditionType browse name.
     */
    var conditionName = options.conditionName || "Unset Condition Name";
    assert(_.isString(conditionName));
    conditionNode.conditionName.setValueFromSource({dataType: DataType.String, value: conditionName});


    // set SourceNode and SourceName based on HasCondition node
    var sourceNodes = conditionNode.findReferencesAsObject("HasCondition", false);
    if (sourceNodes.length) {
        assert(sourceNodes.length == 1);
        conditionNode.setSourceNode(sourceNodes[0].nodeId);
        conditionNode.setSourceName(sourceNodes[0].browseName.toString());
    }

    conditionNode.post_initialize();

    var branch0 = conditionNode.currentBranch();
    branch0.setRetain(false);
    branch0.setComment("Initialized");
    branch0.setQuality(StatusCodes.Good);
    branch0.setSeverity(0);
    branch0.setLocalTime(new TimeZone({offset: 0, daylightSavingInOffset: false}));
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
