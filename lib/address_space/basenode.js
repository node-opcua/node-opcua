/**
 * @module opcua.address_space
 */


var NodeClass = require("./../datamodel/nodeclass").NodeClass;
var NodeId = require("../datamodel/nodeid").NodeId;
var makeNodeId  = require("../datamodel/nodeid").makeNodeId;
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;
var s = require("../datamodel/structures");
var coerceQualifyName = s.coerceQualifyName;
var coerceLocalizedText = s.coerceLocalizedText;

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


/**
 * @method findReference
 * @param object
 * @param strReference
 * @param isForward
 * @return {*}
 */
function findReference(object,strReference,isForward) {
    assert( undefined !== object," missing reference ");
    isForward = (isForward === null)? true: isForward;

    assert(object.references);
    var f = _.find(object.references,function(ref){
            return ref.referenceType === strReference && ref.isForward === isForward}
    );
    return f;
}
exports.findReference = findReference;

/**
 * Base class for all address_space classes
 *
 * @class BaseNode
 *
 * @param options
 * @constructor
 *
 * BaseNode is the base class for all the OPCUA objects in the address space
 * It provides attributes and a set of references to other nodes.
 *
 */
function BaseNode(options) {

    Object.defineProperty(this, "__address_space", { value: options.address_space, enumerable: false });

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    options.displayName = options.displayName || options.browseName; // xx { locale: "en", text: options.browseName };

    this.displayName = [];
    if (typeof options.displayName === "string") {
        this.displayName.push(new s.LocalizedText({ locale: null, text: options.displayName }));
    }
    this.references = options.references || [];
    this.back_references = [];

    this._cache = {};

    var td = findReference(options,"HasTypeDefinition",true);
    this._cache.hasTypeDefinition = td ? td.nodeId : null;

    td = findReference(options,"Organizes",false);
    this._cache.parent    = td ? td.nodeId : null;

    dumpIf(!this.nodeClass,this);
    assert(this.nodeClass);
}

/**
 * @property hasTypeDefinition {Boolean}
 */
BaseNode.prototype.__defineGetter__("hasTypeDefinition", function(){
    return this._cache.hasTypeDefinition;
});

/**
 * @property parent {BaseNode} - the parent node
 */
BaseNode.prototype.__defineGetter__("parent",function(){
    return this._cache.parent;
});

/**
 * @method resolveNodeId
 * @param nodeId
 * @returns {NodeId}
 */
BaseNode.prototype.resolveNodeId = function(nodeId) {
    return this.__address_space.resolveNodeId(nodeId);
};

BaseNode.prototype._add_backward_reference = function(reference) {
    assert(reference.referenceType !== null);
    assert(reference.isForward !== null);
    assert(reference.nodeId!== null);
    this.back_references.push(reference);
};

/**
 *
 * @param address_space
 */
BaseNode.prototype.propagate_back_references = function(address_space) {

    var node = this;
    node.references.forEach(function(reference){

        if (reference.referenceType === "Organizes" ) {
            var parent = address_space.findObject(reference.nodeId);
            if (parent) {
                parent._add_backward_reference({
                    referenceType: reference.referenceType,
                    isForward: !reference.isForward,
                    nodeId: node.nodeId
                });
            } // else address_space may be incomplete
        }
    });
};

/**
 * @method readAttribute
 * @param attributeId
 * @returns {DataValue}
 */
BaseNode.prototype.readAttribute = function (attributeId) {

    var options = {};
    options.statusCode = StatusCodes.Good;
    switch (attributeId) {
        case AttributeIds.NodeId:  // NodeId
            options.value = { dataType: DataType.NodeId, value: this.nodeId };
            break;
        case AttributeIds.NodeClass: // NodeClass
            assert(isFinite(this.nodeClass.value));
            options.value = { dataType: DataType.Int32, value: this.nodeClass.value };
            break;
        case AttributeIds.BrowseName: // QualifiedName
            // QualifiedName
            options.value = { dataType: DataType.QualifiedName, value: { name: this.browseName, namespaceIndex: 0 } };
            break;
        case AttributeIds.DisplayName: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: this.displayName[0] };
            break;
        case AttributeIds.Description: // LocalizedText
            options.value = { dataType: DataType.LocalizedText, value: { locale: null , text: ""} };
            break;

        case AttributeIds.WriteMask:
            console.log(" warning WriteMask not implemented " + this.nodeId.toString());
            options.value = { dataType: DataType.UInt32, value: 0 };
            break;

        case AttributeIds.UserWriteMask:
            console.log(" warning UserWriteMask not implemented " + this.nodeId.toString());
            options.value = { dataType: DataType.UInt32, value: 0 };
            break;
        default:
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
    }
    return new DataValue(options);
};

BaseNode.prototype.write = function(/*writeValue*/) {
    // by default Node is read-only,
    // this method needs to be overridden to change the behavior
    return StatusCodes.Bad_NotWritable;
};

/**
 * @method full_name
 * @return {String} the full path name of the node
 *
 */
BaseNode.prototype.full_name = function() {
    if (this.parentNodeId) {
        var parent = this.__address_space.findObject(this.parentNodeId);
        if (parent) {
            return parent.full_name() + "." + this.browseName +"";
        } else {
            return "<NOT YET REGISTERED>" + this.parentNodeId.toString() + "." + this.browseName +"";
        }
    }
    return this.browseName;
};


/**
 * @method browseNodeByTargetName
 * @param relativePath
 * @return {NodeId[]}
 */
BaseNode.prototype.browseNodeByTargetName = function(relativePath) {
    var self  =this;

    assert(relativePath.targetName.namespaceIndex>=0);
    assert(relativePath.targetName.name.length >0);
    assert(relativePath.hasOwnProperty("referenceTypeId"));
    assert(relativePath.hasOwnProperty("isInverse"));
    assert(relativePath.hasOwnProperty("includeSubtypes"));

    var references = self.references.concat(self.back_references);

    var nodeIds = [];
    references.forEach(function(reference){
        var referenceTypeId = self.__address_space.findReferenceType(reference.referenceType).nodeId;
        assert(referenceTypeId instanceof NodeId);
        if (reference.isForward) {}
        var obj = self.__address_space.findObject(reference.nodeId);
        if (obj) {
            if(reference.nodeId.namespace === relativePath.targetName.namespaceIndex) {
                if (obj.browseName === relativePath.targetName.name ) {
                    nodeIds.push(obj.nodeId);
                }
            }
        } else {
            console.log(" cannot find node with id ",reference.nodeId.toString());
        }
    });

    return nodeIds;
};

var _makeReferenceDescription = function (address_space,reference, isForward) {

    var referenceTypeId = address_space.findReferenceType(reference.referenceType).nodeId;
    assert(referenceTypeId instanceof NodeId);

    var obj = address_space.findObject(reference.nodeId);

    var data = {};

    if (!obj) {
        // cannot find reference node
        data = {
            referenceTypeId: referenceTypeId,
            isForward:       isForward,
            nodeId:          reference.nodeId
        };
    } else {
        assert(reference.nodeId , obj.nodeId);
        data = {
            referenceTypeId: referenceTypeId,
            isForward:       isForward,
            nodeId:          obj.nodeId,
            browseName:      coerceQualifyName(obj.browseName),
            displayName:     coerceLocalizedText(obj.displayName[0]),
            nodeClass:       obj.nodeClass,
            typeDefinition:  obj.hasTypeDefinition
        };
    }
    if (data.typeDefinition === null ) {
        data.typeDefinition = resolveNodeId("i=0");
        //xx console.log("typeDefinition === null" , util.inspect(obj,{colors:true,depth:10}));
    }
    assert(referenceTypeId instanceof NodeId);
    return new browse_service.ReferenceDescription(data);
};

function nodeid_is_nothing(nodeid) {
    return ( nodeid.value === 0 && nodeid.namespace === 0);
}

function normalize_referenceTypeId(address_space, referenceTypeId) {
    if (!referenceTypeId) {
        return makeNodeId(0);
    }
    if (typeof referenceTypeId === "string") {
        var ref = address_space.findReferenceType(referenceTypeId);
        if (ref) {
            return ref.nodeId;
        }
    }
    return address_space.resolveNodeId(referenceTypeId);
}



/**
 * browse the node to extract information requesting in browseDescription
 * @method browseNode
 * @param browseDescription {BrowseDescription}
 * @return {ReferenceDescription[]}
 */
BaseNode.prototype.browseNode = function(browseDescription) {

    var references;
    var referenceTypeId = normalize_referenceTypeId(this.__address_space,browseDescription.referenceTypeId);
    assert(referenceTypeId instanceof NodeId);

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    var self = this;
    var address_space = self.__address_space;

    // get all possible references
    references = self.references.concat(self.back_references);

    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {
        assert (referenceTypeId instanceof NodeId);
        var referenceType = self.__address_space.findObject(referenceTypeId);
        assert(referenceType instanceof ReferenceType);

        references = references.filter(function(reference){

            var ref = self.__address_space.findObject(reference.referenceType);
            assert(ref instanceof ReferenceType);
            if (browseDescription.includeSubtypes) {
                return ref.isSubtypeOf(referenceType);

            } else {
                return ref.nodeId.toString() === referenceType.nodeId.toString();
            }
        });
    }
    var f = [];

    function forwardOnly(reference){ return reference.isForward;}

    function reverseOnly(reference){ return !reference.isForward;}


    if (browseDirection === BrowseDirection.Forward || browseDirection === BrowseDirection.Both) {
        f = references.filter(forwardOnly).map(function (reference) {
            return _makeReferenceDescription(address_space,reference, true);
        });
    }
    var b = [];
    if (browseDirection === BrowseDirection.Inverse || browseDirection === BrowseDirection.Both) {
        b = references.filter(reverseOnly).map(function (reference) {
            return _makeReferenceDescription(address_space,reference, false);
        });
    }
    var references = f.concat(b);
    return references;
};

exports.BaseNode = BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;