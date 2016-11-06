"use strict";

/**
 * @module opcua.address_space
 * @class AddressSpace
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
var NodeId = require("lib/datamodel/nodeid").NodeId;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var EventData = require("lib/address_space/address_space_add_event_type").EventData;

function _record_condition_state(condition) {

    var _map= {};
    assert(condition instanceof UAConditionBase);

    function _visit(node) {
        var aggregates = node.getAggregates();
        aggregates.forEach(function(aggregate){
            if (aggregate instanceof UAVariable) {
                //xx console.log("xxxx ",aggregate.browseName.toString(),aggregate.nodeId.toString());
                var key = aggregate.nodeId.toString();
                _map[key] =  aggregate.readValue().value;
                _visit(aggregate);
            }
        });
    }
    _visit(condition);
    return _map;
}

function ConditionSnapshot(condition,branchId)
{
    var self = this;
    if (condition && branchId) {
        assert(branchId instanceof NodeId);

        self.branchId = branchId;
        self.condition=condition;
        self.eventData = new EventData(condition);
        // a nodeId/Variant map
        self._map = _record_condition_state(condition);
    }
}
util.inherits(ConditionSnapshot,EventEmitter);

ConditionSnapshot.prototype.clone = function()
{
    var self = this;
    var clone = new ConditionSnapshot();
    clone.branchId  = self.branchId;
    clone.condition = self.condition;
    clone.eventData = new EventData(clone.condition);
    clone._map = _.clone(self._map);

    return clone;
};

ConditionSnapshot.prototype.resolveSelectClause = function(selectClause) {
    var self = this;
    return self.eventData.resolveSelectClause(selectClause);
};

ConditionSnapshot.prototype.readValue = function(nodeId,selectClause) {
    var self = this;
    var key = nodeId.toString();
    var variant = self._map[key];
    if (!variant) {
        // the value is not handled by us .. let's delegate
        // to the eventData helper object
        return self.eventData.readValue(nodeId,selectClause);
    }
    assert(variant instanceof Variant);
    return variant;
};

ConditionSnapshot.prototype._get_var = function(varName,dataType) {
    var self = this;
    var node = self.condition[varName];
    var key = node.nodeId.toString();
    var variant = self._map[key];
    return variant.value;
};

ConditionSnapshot.prototype._set_var = function(varName,dataType,value) {

    var self = this;
    var node = self.condition[varName];
    var key = node.nodeId.toString();
    self._map[key] = new Variant({ dataType: dataType , value: value});
    var variant = self._map[key];
    //xx variant.value = value;
    self.emit("valueChanged",node,variant);

};

ConditionSnapshot.prototype.getEventId = function()
{
    var self = this;
    return self._get_var("eventId",DataType.ByteString);

};
ConditionSnapshot.prototype.getRetain = function()
{
    var self = this;
    return self._get_var("retain",DataType.Boolean);
};

ConditionSnapshot.prototype.setRetain = function(retainFlag)
{
    var self = this;
    retainFlag = !!retainFlag;
    return self._set_var("retain",DataType.Boolean,retainFlag);
};


ConditionSnapshot.prototype.renewEventId = function(eventId)
{
    var self = this;
    var addressSpace = self.condition.addressSpace;
    // create a new event  Id for this new condition
    var eventId = addressSpace.generateEventId();
    return self._set_var("eventId",DataType.ByteString,eventId.value);
};


ConditionSnapshot.prototype.getComment = function() {
    var self = this;
    return self._get_var("comment",DataType.LocalizedText);
};

/**
 * @method setComment
 *
 * Comment contains the last comment provided for a certain state (ConditionBranch). It may
 * have been provided by an AddComment Method, some other Method or in some other
 * manner. The initial value of this Variable is null, unless it is provided in some other manner. If
 * a Method provides as an option the ability to set a Comment, then the value of this Variable is
 * reset to null if an optional comment is not provided.
 *
 * @param txtMessage
 */
ConditionSnapshot.prototype.setComment = function(txtMessage) {
    var self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    self._set_var("comment",DataType.LocalizedText,txtMessage);
    /*
     * OPCUA Spec 1.0.3 - Part 9:
     * Comment, severity and quality are important elements of Conditions and any change
     * to them will cause Event Notifications.
     *
     */
    self._need_event_raise = true;
};

ConditionSnapshot.prototype.setMessage = function(txtMessage) {
    var self = this;
    assert(txtMessage);
    txtMessage = coerceLocalizedText(txtMessage);
    return  self._set_var("message",DataType.LocalizedText,txtMessage);
};

ConditionSnapshot.prototype.setClientUserId = function (userIdentity) {
    var self = this;
    return self._set_var("clientUserId",DataType.String,userIdentity.toString());
};

/**
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
 * @param quality {StatusCode}
 */
ConditionSnapshot.prototype.setQuality = function(quality) {
    var self = this;
    assert(quality instanceof StatusCode);
    assert(quality.hasOwnProperty("value") || "quality must be a StatusCode");
    self._set_var("quality",DataType.StatusCode,quality);
    /*
     * OPCUA Spec 1.0.3 - Part 9:
     * Comment, severity and quality are important elements of Conditions and any change
     * to them will cause Event Notifications.
     *
     */
    self._need_event_raise = true;

};
ConditionSnapshot.prototype.getQuality = function() {
    var self = this;
    return self._get_var("quality",DataType.StatusCode);
};

/**
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
 *
 * @param severity
 */
ConditionSnapshot.prototype.setSeverity = function(severity) {
    var self = this;
    // record automatically last severity
    var lastSeverity = self.getSeverity();
    self.setLastSeverity(lastSeverity);
    self._set_var("severity",DataType.UInt16,severity);
    /*
     * OPCUA Spec 1.0.3 - Part 9:
     * Comment, severity and quality are important elements of Conditions and any change
     * to them will cause Event Notifications.
     *
     */
    self._need_event_raise = true;

};

ConditionSnapshot.prototype.getSeverity = function() {
    var self = this;
    return self._get_var("severity",DataType.UInt16);
};
/**
 * as per spec 1.0.3 - part 9:
 *  LastSeverity provides the previous severity of the ConditionBranch. Initially this Variable
 *  contains a zero value; it will return a value only after a severity change. The new severity is
 *  supplied via the Severity Property which is inherited from the BaseEventType.
 *
 */
ConditionSnapshot.prototype.setLastSeverity = function(severity) {
    var self = this;
    severity = +severity;
    return self._set_var("lastSeverity",DataType.UInt16,severity);
};

ConditionSnapshot.prototype.getLastSeverity = function() {
    var self = this;
    var value =  self._get_var("lastSeverity",DataType.UInt16);
    return +value;
};

/**
 * as per OPCUA 1.0.3 part 5
 * time as UTCTime
 * ReceiveTime provides the time the OPC UA Server received the Event from the underlying
 * device of another Server. ReceiveTime is analogous to ServerTimestamp defined in Part 4, i.e.
 * in the case where the OPC UA Server gets an Event from another OPC UA Server, each Server
 * applies its own ReceiveTime. That implies that a Client may get the same Event, having the
 * same EventId, from different Servers having different values of the ReceiveTime. The
 * ReceiveTime shall always be returned as value and the Server is not allowed to return a
 * StatusCode for the ReceiveTime indicating an error.
 * @param time
 */
ConditionSnapshot.prototype.setReceiveTime = function(time) {
    assert(time instanceof Date);
    var self = this;
    return self._set_var("receiveTime",DataType.DateTime,time);
};

/**
 * as per OPCUA 1.0.3 part 5
 * time as UTCTime
 * Time provides the time the Event occurred. This value is set as close to the event generator as
 * possible. It often comes from the underlying system or device. Once set, intermediate OPC UA
 * Servers shall not alter the value.
 * @param time {
 */
ConditionSnapshot.prototype.setTime = function(time) {
    assert(time instanceof Date);
    var self = this;
    return self._set_var("time",DataType.DateTime,time);
};

/**
 * LocalTime is a structure containing the Offset and the DaylightSavingInOffset flag. The Offset
 * specifies the time difference (in minutes) between the Time Property and the time at the location
 * in which the event was issued. If DaylightSavingInOffset is TRUE, then Standard/Daylight
 * savings time (DST) at the originating location is in effect and Offset includes the DST c orrection.
 * If FALSE then the Offset does not include DST correction and DST may or may not have been
 * in effect.
 */
ConditionSnapshot.prototype.setLocalTime = function(localTime) {
    var TimeZone = require("lib/datamodel/time_zone").TimeZone;
    assert(localTime instanceof TimeZone);
    var self = this;
    return self._set_var("localTime",DataType.ExtensionObject, new TimeZone(localTime));
};
// read only !
ConditionSnapshot.prototype.getSourceName = function() { return this._get_var("sourceName",DataType.LocalizedText); };
ConditionSnapshot.prototype.getSourceNode = function() { return this._get_var("sourceNode",DataType.NodeId); };
ConditionSnapshot.prototype.getEventType  = function() { return this._get_var("eventType", DataType.NodeId); };
ConditionSnapshot.prototype.getMessage    = function() { return this._get_var("message",   DataType.LocalizedText); };

exports.ConditionSnapshot = ConditionSnapshot;

function UAConditionBase() {

}
util.inherits(UAConditionBase,UAObject);
UAConditionBase.prototype.nodeClass = NodeClass.Object;
UAConditionBase.typeDefinition = resolveNodeId("ConditionType");

UAConditionBase.prototype.initialize = function() {

    var self = this;

    self._branches = {};
};

UAConditionBase.prototype.post_initialize = function() {

    var self = this;
    assert(!self._branch0);
    self._branch0 =  new ConditionSnapshot(self,NodeId.NullNodeId);

    // the condition OPCUA object alway reflect the default branch states
    // so we set a mechanism that automatically keeps self in sync
    // with the default branch.
    self._branch0.on("valueChanged",function(node,variant){
        node.setValueFromSource(variant);
    });
};

UAConditionBase.prototype.getBranchCount = function() {
    var self = this;
    return Object.keys(self._branches).length;
};

var ec = require("lib/misc/encode_decode");
var randomGuid = ec.randomGuid;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;

function _create_new_branch_id() {
    return makeNodeId(randomGuid(),1);
}

UAConditionBase.prototype.createBranch = function() {
    var self = this;
    var branchId = _create_new_branch_id();
    var snapshot = new ConditionSnapshot(self,branchId);
    self._branches[branchId.toString()] = snapshot;
    return snapshot;
};



var minDate =  new Date(1600,1,1);

function prepare_date(sourceTimestamp) {
    if (!sourceTimestamp || !sourceTimestamp.value) {
        return minDate;
    }
    assert(sourceTimestamp.value instanceof Date);
    return sourceTimestamp;
}

function _install_condition_variable_type(node) {

    // from spec 1.03 : 5.3 condition variables
    // However,  a change in their value is considered important and supposed to trigger
    // an Event Notification. These information elements are called ConditionVariables.


    // from spec 1.03 : 5.3 condition variables
    // a condition VariableType has a sourceTimeStamp exposed property
    // SourceTimestamp indicates the time of the last change of the Value of this ConditionVariable.
    // It shall be the same time that would be returned from the Read Service inside the DataValue
    // structure for the ConditionVariable Value Attribute.

    assert(node.typeDefinitionObj.browseName.toString() === "ConditionVariableType");
    assert(node.sourceTimestamp.browseName.toString().should.eql("SourceTimestamp"));

    node.sourceTimestamp.bindVariable({
        get: function() {
            var sourceTimestamp =  prepare_date(node.readValue().sourceTimestamp);
            return new Variant({
                dataType: DataType.DateTime,
                value: sourceTimestamp
            });
        }
    },true);
}

UAConditionBase.prototype.getEnabledState = function() {
    var conditionNode = this;
    return !!conditionNode.enabledState.id.readValue().value.value;
};

UAConditionBase.prototype._setEnabledState = function (requestedEnableState) {

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
        conditionNode.currentBranch().setRetain(false);
    } else {
        //* When the Condition instance enters the enabled state, the Condition shall be
        //  evaluated and all of its Properties updated to reflect the current values. If this
        //  evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
        //  then an Event Notification shall be generated for that ConditionBranch.
        // todo evaluate branches

        // todo send notification for branches with retain = true
        if (conditionNode.currentBranch().getRetain()) {
            conditionNode._raiseCondition();
        }
    }
    return StatusCodes.Good;
};

UAConditionBase.prototype.setReceiveTime = function(time) {
    var self = this;
    return self._branch0.setReceiveTime(time);
};
UAConditionBase.prototype.setLocalTime = function(time) {
    var self = this;
    return self._branch0.setLocalTime(time);
};
UAConditionBase.prototype.setTime = function(time) {
    var self = this;
    return self._branch0.setTime(time);
};

UAConditionBase.prototype._assert_valid = function() {

    var self = this;
    assert(self.receiveTime.readValue().value.dataType.should.eql(DataType.DateTime));
    assert(self.receiveTime.readValue().value.value.should.be.instanceOf(Date));

    assert(self.localTime.readValue().value.dataType.should.eql(DataType.ExtensionObject));
    assert(self.message.readValue().value.dataType.should.eql(DataType.LocalizedText));
    assert(self.severity.readValue().value.dataType.should.eql(DataType.UInt16));

    assert(self.time.readValue().value.dataType.should.eql(DataType.DateTime));
    assert(self.time.readValue().value.value.should.be.instanceOf(Date));

    assert(self.quality.readValue().value.dataType.should.eql(DataType.StatusCode));
    assert(self.enabledState.readValue().value.dataType.should.eql(DataType.LocalizedText));
    assert(self.branchId.readValue().value.dataType.should.eql(DataType.NodeId));
};

/**
 * Raise a Instance Event
 * ( see also UAObject#raiseEvent to raise a transient event
 */
UAConditionBase.prototype.raiseConditionEvent = function(branch)
{
    var self = this;
    self._assert_valid();
    //xx var eventData = new EventData(self);
    //xx self._bubble_up_event(eventData);
    self._bubble_up_event(branch);

};

/**
 *
 * @param options
 * @param options.message {String|LocalizedText} the event message
 * @param options.severity {UInt16} severity
 * @param options.quality {StatusCode} quality
 *
 */
UAConditionBase.prototype.raiseNewCondition = function(options) {

    var TimeZone = require("lib/datamodel/time_zone").TimeZone;
    options = options || {};

    options.message = options.message || "put your condition message here";
    options.severity = options.severity || 250;



    //only valid for ConditionObjects
    // todo check that object is of type ConditionType

    var self = this;
    var addressSpace = self.addressSpace;

    var selfConditionType = self.typeDefinitionObj;
    var conditionType = addressSpace.findObjectType("ConditionType");

    assert(selfConditionType.isSupertypeOf(conditionType));

    var branch = self.currentBranch();

    branch.renewEventId();

    // install the eventTimestamp
    // set the received Time
    branch.setTime(new Date());
    branch.setReceiveTime(new Date());
    branch.setLocalTime(new TimeZone({offset: 0, daylightSavingInOffset:false}));

    //xxx console.log( Object.keys(self));
    if(options.hasOwnProperty("message")) {
        branch.setMessage(options.message);
    }

    // todo receive time : when the server received the event from the underlying system.
    // self.receiveTime.setValueFromSource();

    if (options.hasOwnProperty("severity")) {
        branch.setSeverity(options.severity);
    }
    if (options.hasOwnProperty("quality")) {
        branch.setQuality(options.quality);
    }
    self.raiseConditionEvent(branch);
};



function sameBuffer(b1,b2) {

    if (!b1 && !b2) {
        return true;
    }
    if (b1 && !b2) {
        return false;
    }
    if (!b1 && b2) {
        return false;
    }
    if (b1.length != b2.length) {
        return false;
    }
    var bb1 =  (new Buffer(b1)).toString("hex");
    var bb2 =  (new Buffer(b2)).toString("hex");
    return bb1 == bb2;

    var n= b1.length;
    for (var i=0;i<n;i++){
        if (b1[i] != b2[i]) {
            return false;
        }
    }
    return true;
}
UAConditionBase.prototype._findBranchForEventId =  function (eventId) {

    // todo : support many branches
    var conditionNode = this;
    if (sameBuffer(conditionNode.eventId.readValue().value.value,eventId)) {
        return conditionNode.currentBranch();
    }
    return null; // not found
};


exports.UAConditionBase    = UAConditionBase;


UAConditionBase.prototype._raiseAuditConditionCommentEvent = function(sourceName,eventId,comment) {
    // todo
};

UAConditionBase.prototype.currentBranch = function() {
    return this._branch0;
};

/**
 * Helper method to handle condition methods that takes a branchId and a comment
 * @param inputArguments
 * @param context
 * @param callback
 * @param inner_func
 * @returns {*}
 */
UAConditionBase.with_condition_method = function (inputArguments, context, callback , inner_func)
{
    var conditionNode = context.object;

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {statusCode: StatusCode.BadNodeIdInvalid});
    }

    if (!conditionNode.getEnabledState() ) {
        return callback(null, {statusCode: StatusCode.BadConditionDisabled});
    }

    // inputArguments has 2 arguments
    // EventId  => NodeId The Identifier of the event to comment
    // Comment  => NodeId The Comment to add to the condition
    assert(inputArguments.length === 2);
    var eventId = inputArguments[0].value;
    var comment = inputArguments[1].value;
    assert(comment instanceof LocalizedText);
    assert(!eventId || eventId instanceof Buffer);

    var branch = conditionNode._findBranchForEventId(eventId);
    if (!branch) {
        return  callback(null,{statusCode: StatusCodes.BadEventIdUnknown });
    }

    var statusCode = inner_func(eventId,comment,branch,conditionNode);

    // record also who did the call
    branch.setClientUserId(context.userIdentity || "<unknown client user id>");

    return callback(null, {statusCode: statusCode});

};

UAConditionBase.prototype._resend_conditionEvents = function() {

    // for the time being , only currentbrachn
    var self = this;
    var currentBranch = self.currentBranch();
    if (currentBranch.getRetain()) {
        self.raiseConditionEvent(currentBranch);
    }
};


BaseNode.prototype._conditionRefresh = function(_cache) {

    // visit all notifiers recursively
    _cache = _cache || {};
    var self = this;
    var notifiers = self.getNotifiers();
    var eventSources = self.getEventSources();

    var conditions = this.findReferencesAsObject("HasCondition", true);

    for(var i=0;i< conditions.length; i++ ) {
        var condition = conditions[i];
        if (condition instanceof UAConditionBase) {
            condition._resend_conditionEvents();
        }
    }
    var arr = [].concat(notifiers,eventSources);

    for(var i=0;i< arr.length; i++ ) {
       var notifier = arr[i];
       var key = notifier.nodeId.toString();
       if (!_cache[key]) {
            _cache[key] = notifier;
           if( notifier._conditionRefresh) {
               notifier._conditionRefresh(_cache);
           }
       }
    }
};


function _perform_condition_refresh(addressSpace, inputArguments, context)
{

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

    var server =context.object.addressSpace.rootFolder.objects.server;
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

    var statusCode = StatusCodes.Good;
    return statusCode;
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
    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch,conditionNode) {

        assert(branch instanceof ConditionSnapshot);
        branch.setComment(comment);

        var sourceName = "Method/AddComment";

        conditionNode._raiseAuditConditionCommentEvent(sourceName,eventId,comment);

        // raise new event
        conditionNode.raiseNewCondition();

        return StatusCodes.Good;
    });
}


function _enable_method(inputArguments, context, callback) {
    assert(inputArguments.length === 0);
    var conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {statusCode: StatusCode.BadNodeIdInvalid});
    }
    var statusCode = conditionNode._setEnabledState(true);
    return callback(null, {statusCode: statusCode});

}

function _disable_method(inputArguments, context, callback) {

    assert(inputArguments.length === 0);

    var conditionNode = context.object;
    assert(conditionNode);

    if (!(conditionNode instanceof UAConditionBase)) {
        return callback(null, {statusCode: StatusCode.BadNodeIdInvalid});
    }
    var statusCode = conditionNode._setEnabledState(false);
    return callback(null, {statusCode: statusCode});
}

var Subscription = require("lib/server/subscription").Subscription;

Subscription.prototype.conditionRefresh = function() {
    // resend conditions

};





/**
 * verify that the subscription id belongs to the session that
 * make the call.
 * @private
 */
function _check_subscription_id_is_valid(subscriptionId, context)
{
    return StatusCodes.BadSubscriptionIdInvalid;
}

function _condition_refresh_method(inputArguments, context,callback) {

    // arguments : IntegerId SubscriptionId
    assert(inputArguments.length == 1);

    var addressSpace = context.object.addressSpace;
    console.log(" ConditionType.ConditionRefresh ! subscriptionId =".red.bgWhite,inputArguments[0].toString());
    var subscriptionId = inputArguments[0].value;
    var statusCode = _perform_condition_refresh(addressSpace,inputArguments, context);
    return callback(null, {statusCode: statusCode});
}

function _condition_refresh2_method(inputArguments, context,callback) {

    // arguments : IntegerId SubscriptionId
    // arguments : IntegerId MonitoredItemId
    assert(inputArguments.length == 2);

    var addressSpace = context.object.addressSpace;
    assert(context.server instanceof OPCUAServer);
    console.log(" ConditionType.conditionRefresh2 !".cyan.bgWhite);
    var subscriptionId  = inputArguments[0].value;
    var monitoredItemId = inputArguments[1].value;

    var statusCode = _perform_condition_refresh(addressSpace,inputArguments, context);
    return callback(null, {statusCode: statusCode});
}

exports.install = function (AddressSpace) {

    AddressSpace.prototype.installAlarmsAndConditionsService = function () {
        _install_condition_refresh_handle(this);
    };

    function _install_condition_refresh_handle(addressSpace) {

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
        assert(conditionType !=null);

        conditionType.conditionRefresh.bindMethod(_condition_refresh_method);

        conditionType.conditionRefresh2.bindMethod(_condition_refresh2_method);

        // those methods can be call on the ConditionType or on the ConditionInstance itself...
        conditionType.addComment.bindMethod(_add_comment_method);

    }

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
    function _getCompositeKey(node,key) {

        var cur = node;
        var elements = key.split(".");
        for (var i = 0; i< elements.length ; i++ ) {
            var e = elements[i];

            // istanbul ignore next
            if (!cur.hasOwnProperty(e)) {
                throw new Error(" cannot extract '" + key +"' from " + node.browseName.toString() );
            }

            cur = cur[e];

        }
        return cur;
    }

    /**
     * instantiate a Condition.
     * this will create the unique EventId and will set eventType
     * @method instantiateCondition
     * @param conditionTypeId  {String|NodeId}  the EventType to instantiate
     * @param options              {object}
     * @param options.browseName   {String|QualifiedName}
     * @param options.componentOf  {NodeId|UAObject}
     * @param options.organizedBy  {NodeId|UAObject} ( only provide componentOf or organizedBy but not both)
     * @param options.conditionClassId {NodeId|UAObject}
     * @param options.conditionSource
     * @param data         {object}         a object containing the value to set
     * @param data.eventId {String|NodeId}  the EventType Identifier to instantiate (type cannot be abstract)
     * @return node        {UAConditionBase}
     */
    AddressSpace.prototype.instantiateCondition = function (conditionTypeId, options,data ) {

        var addressSpace = this;

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
            throw new Error(" cannot find Condition Type for ConditionType :" + baseConditionEventType);
        }

        assert(conditionType.isSupertypeOf(baseConditionEventType));

        // assert(_.isString(options.browseName));
        options.browseName = options.browseName || "??? instantiateCondition - missing browseName";

        options.optionals = options.optionals || [];

        //
        options.optionals.push("EnabledState.TrueState");
        options.optionals.push("EnabledState.FalseState");

        options.optionals.push("EnabledState.TransitionTime");
        options.optionals.push("EnabledState.EffectiveTransitionTime");
        options.optionals.push("EnabledState.EffectiveDisplayName");

        var conditionNode = conditionType.instantiate(options);
        Object.setPrototypeOf(conditionNode,UAConditionBase.prototype);
        conditionNode.initialize();

        assert(options.hasOwnProperty("conditionSource")," must specify a condition source either as null or as a UANode Object");


        // the constant property of this condition
        conditionNode.eventType.setValueFromSource({ dataType: DataType.NodeId, value: conditionType.nodeId});

        data = data || {};
        // install initial branch ID (null nodeiD);
        conditionNode.branchId.setValueFromSource({dataType: DataType.NodeId,value: NodeId.NullNodeId });

        // install 'Comment' condition variable
        _install_condition_variable_type(conditionNode.comment);


        // install 'Quality' condition variable
        _install_condition_variable_type(conditionNode.quality);
        //xx conditionNode.quality.setValueFromSource({dataType: DataType.StatusCode,value: StatusCodes.Good });

        // install 'LastSeverity' condition variable
        _install_condition_variable_type(conditionNode.lastSeverity);
        //xx conditionNode.severity.setValueFromSource({dataType: DataType.UInt16,value: 0 });
        //xx conditionNode.lastSeverity.setValueFromSource({dataType: DataType.UInt16,value: 0 });



        // install  'EnabledState' TwoStateVariable
        AddressSpace._install_TwoStateVariable_machinery(conditionNode.enabledState,
            {
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

        // bind condition methods - Enable
        conditionNode.enable.bindMethod(_enable_method);

        conditionNode.disable.bindMethod(_disable_method);

        // bind condition methods - AddComment
        conditionNode.addComment.bindMethod(_add_comment_method);

        assert(conditionNode instanceof UAConditionBase);

        // as per spec:
        //   ConditionSource => cf SourceNode
        conditionNode.sourceNode.setValueFromSource({dataType: DataType.NodeId, value: conditionNode.nodeId});

        if (options.conditionSource != null) {

            var conditionSourceNode = addressSpace.findNode(options.conditionSource.nodeId);

            assert(conditionSourceNode.getEventSourceOfs().length >=1,"conditionSourceNode must be an event source");

            // set source Node
            conditionNode.sourceNode.setValueFromSource(conditionSourceNode.readAttribute(AttributeIds.NodeId).value);

            // set source Name
            conditionNode.sourceName.setValueFromSource(conditionSourceNode.readAttribute(AttributeIds.DisplayName).value);

        }

        conditionNode.eventType.setValueFromSource({dataType: DataType.NodeId ,value: conditionType.nodeId });
        // as per spec:
        //   ConditionClassId specifies in which domain this Condition is used. It is the NodeId of the
        //   corresponding ConditionClassType. See 5.9 for the definition of ConditionClass and a set of
        //   ConditionClasses defined in this standard. When using this Property for filtering, Clients have
        //   to specify all individual ConditionClassType NodeIds. The OfType operator cannot be applied.
        //   BaseConditionClassType is used as class whenever a Condition cannot be assigned to a
        //   more concrete class.
        conditionNode.conditionClassId.setValueFromSource({dataType: DataType.NodeId ,value: NodeId.NullNodeId});

        // as per spec:
        //  ConditionClassName provides the display name of the ConditionClassType.
        conditionNode.conditionClassName.setValueFromSource({dataType: DataType.LocalizedText ,value: coerceLocalizedText("Test")});

        // as per spec:
        //    ConditionName identifies the Condition instance that the Event originated from. It can be used
        //    together with the SourceName in a user display to distinguish between different Condition
        //    instances. If a ConditionSource has only one instance of a ConditionType, and the Server has
        //    no instance name, the Server shall supply the ConditionType browse name.
        conditionNode.conditionName.setValueFromSource({dataType: DataType.String,value: "Test"});


        conditionNode.post_initialize();

        var branch0 = conditionNode.currentBranch();
        branch0.setRetain(false);
        branch0.setComment("Initialized");
        branch0.setQuality(StatusCodes.Good);
        branch0.setSeverity(0);

        // UAConditionBase
        return conditionNode;
    };


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
 */
