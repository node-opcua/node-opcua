"use strict";

/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);

require("set-prototype-of");
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
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var TimeZone = require("lib/datamodel/time_zone").TimeZone;

var EventData = require("lib/address_space/address_space_add_event_type").EventData;


function _getValueAsBoolean(node) {
    assert(!node.id);
    return !!node.readValue().value.value;
}

function _setValueAsBoolean(node,flag) {
    assert(!node.id);
    return node.setValueFromSource({
        dataType: DataType.Boolean,
        value: !!flag
    });
}

function UAConditionBase() {

}
util.inherits(UAConditionBase,UAObject);
UAConditionBase.prototype.nodeClass = NodeClass.Object;
UAConditionBase.typeDefinition = resolveNodeId("ConditionType");

UAConditionBase.prototype.getRetain = function()
{
    var self = this;
    assert(self.retain,"Must have a retain property");
    return  _getValueAsBoolean(self.retain);
};

UAConditionBase.prototype.setRetain = function(retainFlag)
{
    retainFlag = !!retainFlag;
    var self = this;
    _setValueAsBoolean(self.retain,retainFlag);

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
UAConditionBase.prototype.setComment = function(txtMessage) {

    assert(txtMessage);

    var self = this;
    txtMessage = coerceLocalizedText(txtMessage);
    self.comment.setValueFromSource({
        dataType: DataType.LocalizedText,
        value: txtMessage
    });
    // source timestamp
};

UAConditionBase.prototype.getComment = function() {
    var self = this;
    return  self.comment.readValue().value.value;
};

UAConditionBase.prototype.activateAlarm = function() {
    // will set acknowledgeable to false and retain to true
    var self = this;
    self.setRetain(true);
    self.setAckedState(false);
};

UAConditionBase.prototype.desactivateAlarm = function() {
    var self = this;
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
 * @param quality {LocalizedText
 */
UAConditionBase.prototype.setQuality = function(quality) {
    var self = this;
    assert(quality instanceof StatusCode);
    assert(quality.hasOwnProperty("value") || "quality must be a StatusCode");
    self.quality.setValueFromSource({
        dataType: DataType.StatusCode,
        value: quality
    });
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
UAConditionBase.prototype.setSeverity = function(severity) {

    var self = this;

    // record last severity
    var lastSeverity = self.getSeverity();
    self.setLastSeverity(lastSeverity);


    self.severity.setValueFromSource({
        dataType: DataType.UInt16,
        value: severity
    });
};

UAConditionBase.prototype.getSeverity = function() {
    var self = this;
    return  self.severity.readValue().value.value;
};

/**
 * as per spec 1.0.3 - part 9:
 *  LastSeverity provides the previous severity of the ConditionBranch. Initially this Variable
 *  contains a zero value; it will return a value only after a severity change. The new severity is
 *  supplied via the Severity Property which is inherited from the BaseEventType.
 *
 */
UAConditionBase.prototype.setLastSeverity = function(severity) {
    var self = this;
    self.lastSeverity.setValueFromSource({
        dataType: DataType.UInt16,
        value: severity
    });
};
UAConditionBase.prototype.getLastSeverity = function() {
    var self = this;
    return  self.lastSeverity.readValue().value.value;
};


UAConditionBase.prototype._setEnableState = function (requestedEnableState) {

    var conditionNode = this;

    var enabledState = conditionNode.enabledState.id.readValue().value.value;

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
        conditionNode.setRetain(false);

    } else {
        //* When the Condition instance enters the enabled state, the Condition shall be
        //  evaluated and all of its Properties updated to reflect the current values. If this
        //  evaluation causes the Retain Property to transition to TRUE for any ConditionBranch,
        //  then an Event Notification shall be generated for that ConditionBranch.

        // todo evaluate branches

        // todo send notification for branches with retain = true

        if (conditionNode.getRetain()) {
            conditionNode._raiseCondition();
        }
    }
    return StatusCodes.Good;
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
UAConditionBase.prototype.setReceiveTime = function(time) {
    assert(time instanceof Date);

    var self = this;
    self.receiveTime.setValueFromSource({
        dataType: DataType.DateTime,
        value: time
    });
};
/**
 * as per OPCUA 1.0.3 part 5
 * time as UTCTime
 * Time provides the time the Event occurred. This value is set as close to the event generator as
 * possible. It often comes from the underlying system or device. Once set, intermediate OPC UA
 * Servers shall not alter the value.
 * @param time {
 */
UAConditionBase.prototype.setTime = function(time) {
    assert(time instanceof Date);
    var self = this;
    self.time.setValueFromSource({
        dataType: DataType.DateTime,
        value: time
    });
};

/**
 * LocalTime is a structure containing the Offset and the DaylightSavingInOffset flag. The Offset
 * specifies the time difference (in minutes) between the Time Property and the time at the location
 * in which the event was issued. If DaylightSavingInOffset is TRUE, then Standard/Daylight
 * savings time (DST) at the originating location is in effect and Offset includes the DST c orrection.
 * If FALSE then the Offset does not include DST correction and DST may or may not have been
 * in effect.
 */
UAConditionBase.prototype.setLocalTime = function(localTime) {
    assert(localTime instanceof TimeZone);
    var self = this;
    self.localTime.setValueFromSource(new Variant({
            dataType: DataType.ExtensionObject,
            value: new TimeZone(localTime)
     }));
};

UAConditionBase.prototype._populateEventData = function(eventData)
{
    this._populate_EventData_with_BaseEventTypeElements(eventData);
    this._populate_EventData_with_ConditionTypeElements(eventData);
};

/**
 * Raise a Instance Event
 * ( see also UAObject#raiseEvent to raise a transient event
 */
UAConditionBase.prototype.raiseConditionEvent = function()
{
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


    var eventData = new EventData(self);
    self._bubble_up_event(eventData);

/*
    var eventTypeNode = self.typeDefinitionObj;
    var eventData = new EventData(eventTypeNode);
    self._populateEventData(eventData);
    self._bubble_up_event(eventData);
*/
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

    // create a new event  Id for this new condition
    var eventId = addressSpace.generateEventId();
    self.eventId.setValueFromSource(eventId);


    // install the eventTimestamp
    // set the received Time
    self.setTime(new Date());
    self.setReceiveTime(new Date());
    self.setLocalTime(new TimeZone({offset: 0, daylightSavingInOffset:false}));

    //xxx console.log( Object.keys(self));
    if(options.hasOwnProperty("message")) {
        self.message.setValueFromSource({dataType: DataType.LocalizedText, value: coerceLocalizedText(options.message) });
    }


    // todo receive time : when the server received the event from the underlying system.
    // self.receiveTime.setValueFromSource();

    if (options.hasOwnProperty("severity")) {
        self.setSeverity(options.severity);
    }
    if (options.hasOwnProperty("quality")) {
        self.setQuality(options.quality);
    }
    self.raiseConditionEvent();
};


UAConditionBase.prototype._populate_EventData_with_BaseEventTypeElements = function(eventData) {

    var self = this;
    assert(self.receiveTime.readValue().value.dataType.should.eql(DataType.DateTime));
    assert(self.localTime.readValue().value.dataType.should.eql(DataType.ExtensionObject));
    assert(self.message.readValue().value.dataType.should.eql(DataType.LocalizedText));
    assert(self.severity.readValue().value.dataType.should.eql(DataType.UInt16));
    assert(self.time.readValue().value.dataType.should.eql(DataType.DateTime));

    var data = {
        // ---------------------------------------------------------
        // property from BaseEventType/Event
        // ---------------------------------------------------------
        eventId:     self.eventId.readValue().value,
        eventType:   self.eventType.readValue().value,
        localTime:   self.localTime.readValue().value,
        message:     self.message.readValue().value,
        receiveTime: self.receiveTime.readValue().value,
        severity:    self.severity.readValue().value,
        sourceName:  self.sourceName.readValue().value,
        sourceNode:  self.sourceNode.readValue().value
    };
    eventData= _.extend(eventData,data);
};
UAConditionBase.prototype._populate_EventData_with_ConditionTypeElements = function(eventData) {


    var self = this;
    var selfConditionType = self.nodeId; //xx self.typeDefinitionObj;

    // now raise the event using the event mechanism
    var data = {
        // ---------------------------------------------------------
        // property from ConditionType
        // ---------------------------------------------------------
        conditionClassId:   self.conditionClassId.readValue().value,
        conditionClassName: self.conditionClassName.readValue().value,
        conditionName:      self.conditionName.readValue().value,
        branchId:           self.branchId.readValue().value,
        retain:             self.retain.readValue().value,
        enabledState:       self.enabledState.readValue().value,
        quality:            self.quality.readValue().value,
        lastSeverity:       self.lastSeverity.readValue().value,
        comment:            self.comment.readValue().value,
        clientUserId:       self.clientUserId.readValue().value,

    };

    eventData = _.extend(eventData,data);

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
        return conditionNode;
    }
    return null; // not found
};


exports.UAConditionBase = UAConditionBase;
exports._getValueAsBoolean = _getValueAsBoolean;
exports._setValueAsBoolean = _setValueAsBoolean;


UAConditionBase.prototype._raiseAuditConditionCommentEvent = function(sourceName,eventId,comment) {
    // todo
};

UAConditionBase.with_condition_method = function (inputArguments, context, callback , inner_func)
{

    var conditionNode = context.object;

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

    var statusCode = inner_func(eventId,comment,branch);

    return callback(null, {statusCode: statusCode});

};


function _perform_condition_refresh(addressSpace,inputArguments, context)
{
    // Bad_SubscriptionIdInvalid See Part 4 for the description of this result code
    // Bad_RefreshInProgress See Table 74 for the description of this result code
    // Bad_UserAccessDenied The Method was not called in the context of the Session
    // that owns the Subscription

    var server =context.object.addressSpace.rootFolder.objects.server;
    assert(server instanceof UAObject);

    var refreshStartEventType = addressSpace.findEventType("RefreshStartEventType");
    var refreshEndEventType = addressSpace.findEventType("RefreshEndEventType");

    assert(refreshStartEventType instanceof UAObjectType);
    assert(refreshEndEventType instanceof UAObjectType);

    server.raiseEvent(refreshStartEventType, {});
    // to do : resend retained conditions

    server.raiseEvent(refreshEndEventType, {});

    var statusCode = StatusCodes.Good;
    return statusCode;
}


function _add_comment_method(inputArguments, context, callback) {

    UAConditionBase.with_condition_method(inputArguments, context, callback,function(eventId,comment,branch) {
        branch.setComment(comment);
        var sourceName = "Method/AddComment";
        branch._raiseAuditConditionCommentEvent(sourceName,eventId,comment);
        return StatusCodes.Good;
    });
}


exports.install = function (AddressSpace) {


    AddressSpace.prototype.installAlarmsAndConditionsService = function () {
        _install_condition_refresh_handle(this);
    };

    function _install_condition_refresh_handle(addressSpace) {

        console.log("xxxx _install_condition_refresh_handle");
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

        conditionType.conditionRefresh.bindMethod(function (inputArguments, context, callback) {

            var addressSpace = context.object.addressSpace;
            console.log(" ConditionType.ConditionRefresh !".red.bgWhite);
            // arguments : IntegerId SubscriptionId
            var statusCode = _perform_condition_refresh(addressSpace,inputArguments, context);

            return callback(null, {statusCode: statusCode});

        });


        conditionType.conditionRefresh2.bindMethod(function (inputArguments, context, callback) {

            assert(context.server instanceof OPCUAServer);
            console.log(" ConditionType.conditionRefresh2 !".cyan.bgWhite);

            // arguments : IntegerId SubscriptionId
            // arguments : IntegerId MonitoredItemId
            var statusCode = _perform_condition_refresh(addressSpace,inputArguments, context);
            return callback(null, {statusCode: statusCode});
        });

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



        assert(options.hasOwnProperty("conditionSource")," must specify a condition source either as null or as a UANode Object")

        conditionNode.setRetain(false);

        conditionNode.eventType.setValueFromSource({ dataType: DataType.NodeId, value: conditionType.nodeId});

        data = data || {};

        // install initial branch ID (null nodeiD);
        conditionNode.branchId.setValueFromSource({dataType: DataType.NodeId,value: NodeId.NullNodeId });

        // install 'Comment' condition variable
        _install_condition_variable_type(conditionNode.comment);
        conditionNode.setComment("Initialized");


        // install 'Quality' condition variable
        _install_condition_variable_type(conditionNode.quality);
        conditionNode.quality.setValueFromSource({dataType: DataType.StatusCode,value: StatusCodes.Good });

        // install 'LastSeverity' condition variable
        _install_condition_variable_type(conditionNode.lastSeverity);
        conditionNode.severity.setValueFromSource({dataType: DataType.UInt16,value: 0 });
        conditionNode.lastSeverity.setValueFromSource({dataType: DataType.UInt16,value: 0 });

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
        conditionNode.enable.bindMethod(function (inputArguments, context, callback) {
            var statusCode = conditionNode._setEnableState(true);
            return callback(null, {statusCode: statusCode});
        });

        // bind condition methods - Disable
        conditionNode.disable.bindMethod(function (inputArguments, context, callback) {
            var statusCode = conditionNode._setEnableState(false);
            return callback(null, {statusCode: statusCode});
        });

        // bind condition methods - AddComment
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
