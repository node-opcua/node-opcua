/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var BaseNode = require("lib/address_space/basenode").BaseNode;
var ReferenceType= require("lib/address_space/referenceType").ReferenceType;

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var dumpIf = require("lib/misc/utils").dumpIf;

/**
 * @class UADataType
 * @extends  BaseNode
 * @param {Object} options
 * @param {Object} options.definition_name
 * @param {Object[]} options.definition
 *
 * @constructor
 */
function UADataType(options) {

//xx    console.log(" CONSTRUCTING A DATATYPE",options);

    BaseNode.apply(this, arguments);

    this.definition_name = options.definition_name || "<UNKNOWN>";
    this.definition = options.definition || [];

}
util.inherits(UADataType, BaseNode);

UADataType.prototype.getEncodingNodeId = function(encoding_name) {

    assert(encoding_name ===  "Default Binary" ||  encoding_name === "Default XML");
    // could be binary or xml
    var refs = this.findReferences("HasEncoding", true);

    var address_space = this.__address_space;

    var encoding = refs.map(function(ref){return address_space.findObject(ref.nodeId); }).
        filter(function(obj){ return obj.browseName === encoding_name; });

    return encoding.length === 0 ? null: encoding[0];
};

/**
 * returns the encoding of this node's
 * @property hasEncoding {NodeId}
 * TODO objects have 2 encodings : XML and Binaries
 */
UADataType.prototype.__defineGetter__("binaryEncodingNodeId", function () {

    if (!this._cache.binaryEncodingNodeId) {

        var encoding = this.getEncodingNodeId("Default Binary");
        this._cache.binaryEncodingNodeId = encoding ? encoding.nodeId : null;
    }
    return this._cache.binaryEncodingNodeId;
});


UADataType.prototype.nodeClass = NodeClass.DataType;
exports.UADataType = UADataType;

