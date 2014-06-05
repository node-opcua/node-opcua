/**
 * @module opcua.address_space
 */

var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var makeNodeId  = require("../datamodel/nodeid").makeNodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var s = require("../datamodel/structures");


var DataValue = require("../datamodel/datavalue").DataValue;
var Variant = require("../datamodel/variant").Variant;
var DataType = require("../datamodel/variant").DataType;
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var read_service = require("../services/read_service");
var AttributeIds = read_service.AttributeIds;

var browse_service = require("../services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("../misc/utils").dumpIf;


var BaseNode = require("./basenode").BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;

/**
 * @class Variable
 * @extends  BaseNode
 * @param options
 * @constructor

    The AccessLevel Attribute is used to indicate how the Value of a Variable can be accessed (read/write) and if it
    contains current and/or historic data. The AccessLevel does not take any user access rights into account,
    i.e. although the Variable is writeable this may be restricted to a certain user / user group.
    The AccessLevel is an 8-bit unsigned integer with the structure defined in the following table:

    Field	        Bit	Description
    CurrentRead	    0	Indicates if the current value is readable
                        (0 means not readable, 1 means readable).
    CurrentWrite	1	Indicates if the current value is writable
                        (0 means not writable, 1 means writable).
    HistoryRead	    2	Indicates if the history of the value is readable
                        (0 means not readable, 1 means readable).
    HistoryWrite	3	Indicates if the history of the value is writable (0 means not writable, 1 means writable).
    SemanticChange	4	Indicates if the Variable used as Property generates SemanticChangeEvents (see 9.31).
    Reserved	    5:7	Reserved for future use. Shall always be zero.
    The first two bits also indicate if a current value of this Variable is available and the second two bits
    indicates if the history of the Variable is available via the OPC UA server.

 */
const CurrentRead  = 1,
      CurrentWrite = 2,
      HistoryRead = 4,
      HistoryWrite = 8,
    SemanticChange = 16;

function Variable(options) {

    BaseNode.apply(this, arguments);

    assert(this.typeDefinition.value === this.resolveNodeId("VariableTypeNode").value);

    this.value = options.value;


    this.dataType =  this.resolveNodeId(options.dataType);    // DataType (NodeId)
    this.valueRank = options.valueRank  || 0 ;  // UInt32
    this.arrayDimensions = options.arrayDimensions || 0;
    this.accessLevel     = options.accessLevel     || ( CurrentRead + CurrentWrite );
    this.userAccessLevel = options.userAccessLevel || ( CurrentRead + CurrentWrite);

    this.minimumSamplingInterval  = options.minimumSamplingInterval;

    this.parentNodeId = options.parentNodeId;

    this.historizing = options.historizing;

    assert(this.dataType instanceof NodeId);
    assert(_.isFinite(this.minimumSamplingInterval));
    assert(_.isFinite(this.arrayDimensions));
    assert(_.isFinite(this.accessLevel));
    assert(_.isFinite(this.userAccessLevel));
}


util.inherits(Variable, BaseNode);
Variable.prototype.nodeClass = NodeClass.Variable;


/**
 * @method get_variant
 * @return {Variant}
 */
Variable.prototype.get_variant = function() {
    if (!this.value) {
        console.log(" variable has not been bound ( node id = ", this.nodeId.toString() + " )");
        return new Variant();
    }
    assert(this.value._schema.name === "Variant");
    assert(this.value.isValid());

    return this.value;
};

Variable.prototype.readAttribute = function (attributeId) {

    var options = {};

    switch (attributeId) {
        case AttributeIds.Value:
            options.value = this.get_variant();
            if (options.value === null) {
                options.statusCode = StatusCodes.Bad_WaitingForInitialData;
            } else {
                options.statusCode = StatusCodes.Good;
            }
            break;
        case AttributeIds.DataType:
            options.value = { dataType: DataType.NodeId, value: this.dataType};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ValueRank:
            options.value = { dataType: DataType.Int32, value: this.valueRank };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ArrayDimensions:
            options.value = { dataType: DataType.UInt32, value: this.arrayDimensions };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.AccessLevel:
            options.value = { dataType: DataType.Byte, value: this.accessLevel };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.UserAccessLevel:
            options.value = { dataType: DataType.Byte, value: this.userAccessLevel };
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.MinimumSamplingInterval:
            if (this.minimumSamplingInterval === undefined) {
                options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            } else {
                options.value = { dataType: DataType.UInt32, value: this.minimumSamplingInterval };
                options.statusCode = StatusCodes.Good;
            }
            break;
        case AttributeIds.Historizing:
            options.value = { dataType: DataType.Boolean, value: this.historizing };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    //xx console.log("attributeId = ",attributeId); console.log((new Variant(options.value)).isValid());
    return new DataValue(options);
};

Variable.prototype.write = function(writeValue) {


    var statusCode = StatusCodes.Bad_NotWritable;
    if (this._set_func) {
        statusCode = this._set_func(writeValue.value) || StatusCodes.Bad_NotWritable;
    } else {
        this.value = writeValue.value.value;
    }
    return statusCode;
};

/**
 * bind a variable with a get and set functions
 * @method bindVariable
 * @param options
 * @param [options.set] {Function} the variable setter function
 * @param options.get {Function} the variable getter function
 */
Variable.prototype.bindVariable =function(options) {
    options = options || {};

    assert(_.isFunction(options.get));

    this._get_func =options.get;
    this._set_func =options.set;
    Object.defineProperty(this,"value",{
        get: options.get,
        set: options.set || function() {},
        enumerable: true
    });
};

exports.Variable = Variable;
