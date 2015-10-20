"use strict";

/*jslint bitwise: true */
/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var util = require("util");
var EventEmitter = require("events").EventEmitter;

var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var coerceQualifyName = require("lib/datamodel/qualified_name").coerceQualifyName;
var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;

var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

var AttributeNameById = require("lib/datamodel/attributeIds").AttributeNameById;
var ResultMask = require("schemas/ResultMask_enum").ResultMask;
var NodeClass = require("schemas/NodeClass_enum").NodeClass;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;
var assert = require("better-assert");
var _ = require("underscore");
var dumpIf = require("lib/misc/utils").dumpIf;
var ReferenceType = null;// will be defined after baseNode is defined

var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;
var capitalizeFirstLetter = require("lib/misc/utils").capitalizeFirstLetter;

function is_valid_reference(ref) {
    return ref.hasOwnProperty("referenceType") &&
        ref.hasOwnProperty("nodeId") &&
        ref.isForward !== null && ref.isForward !== undefined;
}

function same_reference(r1, r2) {
    assert(is_valid_reference(r1));
    assert(is_valid_reference(r2));
    return r1.referenceType === r2.referenceType &&
        r1.nodeId.toString() === r2.nodeId.toString();
}

/**
 * @class Reference
 * @param options.referenceType {String}
 * @param options.nodeId {NodeId}
 * @param options.isForward {Boolean}
 * @constructor
 */
function Reference(options) {
    this.referenceType = options.referenceType;
    this.isForward = options.isForward;
    this.nodeId = options.nodeId;
    assert(is_valid_reference(this));
}

/**
 * @method toString
 * @return {String}
 */
Reference.prototype.toString = function () {
    return "REF{ " + this.nodeId.toString() + " " + ( this.isForward ? "=>" : "<-" ) + this.referenceType + " }";
};

function find_reference(referenceArray, referenceToFind) {
    assert(_.isArray(referenceArray));

    var found = referenceArray.filter(function (ref) {
        if (ref === referenceToFind) {
            return true;
        }
        return !!same_reference(ref, referenceToFind);

    });
    //xx if (found.length) { console.log(JSON.stringify(found,null," ").yellow);}
    return found;
}


/**
 * verifies that references are existing referenceType. This function
 * will assert for instance if a referenceType is given by it's inverse name.
 * @method _check_reference_type_validity
 * @param address_space {AddressSpace}
 * @param references {Array<reference>}
 *
 * @private
 */
function _check_reference_type_validity(address_space, references) {
    // assert( address_space instanceof AddressSpace);
    _.forEach(references, function (reference) {

        assert(is_valid_reference(reference));
        if (reference.referenceType === "HasSubtype" || reference.referenceType === "HasTypeDefinition") {
            return; // this reference type is known to be correct
        }

        var ref = address_space.findReferenceType(reference.referenceType);

        /* istanbul ignore next */
        if (!ref) {
            console.log(" cannot find reference", reference.referenceType, " ref = ", ref);
        }

        // istanbul ignore next
        if (!_.isObject(ref)) {
            throw new Error("Cannot find reference with type " + reference.referenceType.toString());
        }
    });
}


function normalizeReferenceTypes(addressSpace, references) {

    references.forEach(function (reference) {

        reference.nodeId = resolveNodeId(reference.nodeId);
        if (!(reference.nodeId instanceof NodeId)) {
            throw new Error(" Invalid reference nodeId " + reference.nodeId.toString());
        }
    });

    references = references.map(function (reference) {
        return addressSpace.normalizeReferenceType(reference);
    });
    _check_reference_type_validity(addressSpace, references);
    references = references.map(function (o) {
        return new Reference(o);
    });
    return references;
}

var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;

function _get_QualifiedBrowseName(browseName) {
    return coerceQualifyName(browseName);
}
/**
 * Base class for all address_space classes
 *
 * @class BaseNode
 *
 * @param options
 * @param options.address_space {AddressSpace}
 * @param options.browseName {String}
 * @param [options.displayName] {String|LocalizedText}
 * @param options.references {Reference[]}
 * @param [options.description]  {String|LocalizedText}
 *
 *
 * @constructor
 *
 * BaseNode is the base class for all the OPCUA objects in the address space
 * It provides attributes and a set of references to other nodes.
 * see:
 * {{#crossLink "UAObject"}}{{/crossLink}},
 * {{#crossLink "UAVariable"}}{{/crossLink}},
 * {{#crossLink "Reference"}}{{/crossLink}},
 * {{#crossLink "UAMethod"}}{{/crossLink}},
 * {{#crossLink "UAView"}}{{/crossLink}},
 * {{#crossLink "UAObjecType"}}{{/crossLink}},
 * {{#crossLink "UADataType"}}{{/crossLink}},
 * {{#crossLink "UAVariableType"}}{{/crossLink}},
 *
 *
 */
function BaseNode(options) {

    assert(this.nodeClass);
    assert(options.address_space); // expecting an address space
    options.references = options.references || [];

    // this.__address_space = options.address_space;
    // make address space non enumerable
    Object.defineProperty(this, "__address_space", {value: options.address_space, enumerable: false});

    this.nodeId = resolveNodeId(options.nodeId);

    // QualifiedName
    /**
     * the node browseName
     * @property browseName
     * @type QualifiedName
     * @static
     */
    this.browseName = _get_QualifiedBrowseName(options.browseName);

    // re-use browseName as displayName if displayName is missing
    options.displayName = options.displayName || options.browseName.toString();

    this._setDisplayName(options.displayName);

    this._setDescription(options.description);

    // normalize reference type
    // this will convert any referenceType expressed with its inverseName into
    // its normal name and fix the isForward flag accordingly.
    // ( e.g "ComponentOf" isForward:true => "HasComponent", isForward:false)
    this._references = normalizeReferenceTypes(this.__address_space, options.references);

    this._back_references = [];

    this._cache = {};

    _setup_parent_item.call(this, options.references);

}
util.inherits(BaseNode, EventEmitter);
Object.defineProperty(BaseNode.prototype, "__address_space", {writable: true, hidden: true, enumerable: false});


/**
 * @property displayName
 * @type LocalizedText<>
 */
Object.defineProperty(BaseNode.prototype, "__displayName", {writable: true, hidden: true, enumerable: false});
BaseNode.prototype._setDisplayName = function (displayName) {
    displayName = _.isArray(displayName) ? displayName : [displayName];
    this.__displayName = displayName.map(coerceLocalizedText);
};
Object.defineProperty(BaseNode.prototype, "displayName", {

    get: function () {
        return this.__displayName;
    },
    set: function (value) {
        this._setDisplayName(value);
        /**
         * fires when the displayName is changed.
         * @event DisplayName_changed
         * @param dataValue {DataValue}
         */
        this._notifyAttributeChange(AttributeIds.DisplayName);
    }
});


/**
 * @property description
 * @type LocalizedText
 */
Object.defineProperty(BaseNode.prototype, "__description", {writable: true, hidden: true, enumerable: false});
BaseNode.prototype._setDescription = function (description) {
    this.__description = description ? coerceLocalizedText(description) : null;
};

Object.defineProperty(BaseNode.prototype, "description", {

    get: function () {
        return this.__description;
    },
    set: function (value) {
        this._setDescription(value);
        /**
         * fires when the description attribute is changed.
         * @event Description_changed
         * @param dataValue {DataValue}
         */
        this._notifyAttributeChange(AttributeIds.Description);
    }
});

BaseNode.makeAttributeEventName = function (attributeId) {

    var attributeName = AttributeNameById[attributeId];
    return attributeName + "_changed";
};

BaseNode.prototype._notifyAttributeChange = function (attributeId) {
    var self = this;
    var event_name = BaseNode.makeAttributeEventName(attributeId);
    self.emit(event_name, self.readAttribute(attributeId));
};


/**
 * @method findReferences
 * @param strReference {String} the referenceType as a string.
 * @param  [isForward=true] {Boolean}
 * @return {Array.<Reference>}
 */
BaseNode.prototype.findReferences = function (strReference, isForward) {
    // istanbul ignore next
    if (!(this.__address_space.findReferenceType(strReference))) {
        throw new Error("expecting valid reference name " + strReference);
    }

    isForward = !!((isForward === null || isForward === undefined) ? true : isForward);
    assert(isForward === true || isForward === false);
    assert(this._references);

    var refs1 = _.filter(this._references, function (ref) {
        return ref.referenceType === strReference && ref.isForward === isForward;
    });
    var refs2 = _.filter(this._back_references, function (ref) {
        return ref.referenceType === strReference && ref.isForward === isForward;
    });

    return [].concat(refs1, refs2);
};

/**
 * @method findReference
 * @param strReference {String} the referenceType as a string.
 * @param [isForward] {Boolean|null}
 * @param [optionalSymbolicName] {String}
 * @return {Reference}
 */
BaseNode.prototype.findReference = function (strReference, isForward, optionalSymbolicName) {
    var refs = this.findReferences(strReference, isForward);
    if (optionalSymbolicName) {
        // search reference that matches symbolic name
        refs = refs.filter(function (ref) {
            return ref.symbolicName === optionalSymbolicName;
        });
    }
    assert(refs.length === 1 || refs.length === 0, "findReference: expecting only one or zero element here");
    return refs.length === 0 ? null : refs[0];
};


var displayWarning = true;

/* jshint latedef: false */
function _setup_parent_item(references) {
    /* jshint validthis: true */
    assert(this instanceof BaseNode);
    assert(_.isArray(references));
    assert(!this._cache.parent && "_setup_parent_item has been already called");

    if (references.length > 0) {
        // find a hierarchical reference
        var hierarchicalReferencesId = this.__address_space.findReferenceType("HierarchicalReferences");
        if (hierarchicalReferencesId) {
            assert(hierarchicalReferencesId.nodeId instanceof NodeId);
            var browseResults = this.browseNode({
                browseDirection: BrowseDirection.Inverse,
                referenceTypeId: hierarchicalReferencesId.nodeId, //"HierarchicalReferences"
                includeSubtypes: true,
                nodeClassMask: 0,
                resultMask: 0x3F
            });
            if (browseResults.length >= 1) {
                // istanbul ignore next
                if (browseResults.length > 1) {

                    if (displayWarning) {

                        console.log("  More than one hierarchicalReference has been found for parent of object");
                        console.log("    object node id:", this.nodeId.toString(), this.browseName.toString().cyan);
                        //xx console.log("    browseResults:");
                        //xx console.log(browseResults.map(function (f) {return f.toString();}).join("\n"));
                        console.log("    first one will be used as parent");
                        //xx assert(browseResults.length === 1);
                        displayWarning = false;
                    }
                }
                this._cache.parent = browseResults[0].nodeId;
            }
            //xx else { console.log(" warning cannot find parent for ...", this.browseName);  }
        }
    }
}


BaseNode.prototype.findReferencesAsObject = function (strReference, isForward) {

    var componentsIds = this.findReferences(strReference, isForward);
    var address_space = this.__address_space;

    function toObject(reference) {
        return address_space.findObject(reference.nodeId);
    }

    return componentsIds.map(toObject);
};


/**
 * returns the nodeId of this node's Type Definition
 * @property hasTypeDefinition
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("hasTypeDefinition", function () {
    if (!this._cache.hasTypeDefinition) {
        var has_type_definition_ref = this.findReference("HasTypeDefinition", true);
        this._cache.hasTypeDefinition = has_type_definition_ref ? has_type_definition_ref.nodeId : null;
    }
    return this._cache.hasTypeDefinition;
});


/**
 * returns the nodeId of this node's Type Definition
 * @property hasTypeDefinition
 * @type {BaseNode}
 */
BaseNode.prototype.__defineGetter__("typeDefinitionObj", function () {
    if (undefined === this._cache.typeDefinitionObj) {
        var tmp = this.findReferencesAsObject("HasTypeDefinition", true);

        this._cache.typeDefinitionObj = tmp.length > 0 ? tmp[0] : null;
    }
    return this._cache.typeDefinitionObj;
});

/**
 * @method getComponents
 * @return {BaseNode[]} return an array with the components of this object.
 */
BaseNode.prototype.getComponents = function () {
    if (!this._components) {
        this._components = this.findReferencesAsObject("HasComponent", true);
    }
    return this._components;
};
/**
 * @method getProperties
 * @return {BaseNode[]} return a array with the properties of this object.
 */
BaseNode.prototype.getProperties = function () {
    if (!this._properties) {
        this._properties = this.findReferencesAsObject("HasProperty", true);
    }
    return this._properties;
};

/**
 * retrieve a property by name
 * @method getPropertyByName
 * @param browseName
 * @return {BaseNode|null}
 */
BaseNode.prototype.getPropertyByName = function (browseName) {
    assert(typeof browseName === "string");
    var properties = this.getProperties();
    var select = properties.filter(function (c) {
        return c.browseName.toString() === browseName;
    });
    return select.length === 1 ? select[0] : null;
};

/**
 * returns the list of methods that this object provides
 * @method getMethods
 * @return {Array<UAObject>} returns an array wit"h Method objects.
 *
 *
 * Note: internally, methods are special types of components
 */
BaseNode.prototype.getMethods = function () {

    if (!this._methods) {
        var components = this.getComponents();
        var UAMethod = require("lib/address_space/ua_method").UAMethod;
        this._methods = components.filter(function (obj) {
            return obj instanceof UAMethod;
        });
    }
    return this._methods;
};

/**
 * returns true if the object has some opcua methods
 * @property hasMethods
 * @type {Boolean}
 */
BaseNode.prototype.__defineGetter__("hasMethods", function () {
    return this.getMethods().length > 0;
});

/**
 * @method getMethodById
 * @param nodeId
 * @return {UAMethod|null}
 */
BaseNode.prototype.getMethodById = function (nodeId) {

    var methods = this.getMethods();
    return _.find(methods, function (m) {
        return m.nodeId.toString() === nodeId.toString();
    });
};


/**
 * returns the nodeId of the DataType which is the super type of this
 * @property subtypeOf
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("subtypeOf", function () {

    if (!this._cache.is_subtype_of) {
        var is_subtype_of_ref = this.findReference("HasSubtype", false);
        this._cache.is_subtype_of = is_subtype_of_ref ? is_subtype_of_ref.nodeId : null;
    }
    return this._cache.is_subtype_of;
});


/**
 * @property encodingBinary
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("encodingDefaultBinary", function () {

    if (!this._cache.encodingBinary) {
        var is_subtype_of_ref = this.findReference("HasEncoding", false, "DefaultBinary");
        this._cache.encodingBinary = is_subtype_of_ref ? is_subtype_of_ref.nodeId : null;
    }
    return this._cache.encodingBinary;
});
/**
 * @property encodingXML
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("encodingDefaultXml", function () {

    if (!this._cache.encodingXML) {
        var is_subtype_of_ref = this.findReference("HasSubtype", false, "DefaultXml");
        this._cache.encodingXML = is_subtype_of_ref ? is_subtype_of_ref.nodeId : null;
    }
    return this._cache.encodingXML;
});

/**
 * the parent node
 * @property parent
 * @type {BaseNode}
 */
BaseNode.prototype.__defineGetter__("parent", function () {
    return this._cache.parent;
});

/**
 * @method resolveNodeId
 * @param nodeId
 * @return {NodeId}
 */
BaseNode.prototype.resolveNodeId = function (nodeId) {
    return this.__address_space.resolveNodeId(nodeId);
};

BaseNode.prototype._remove_backward_reference = function (reference) {
    var self = this;
    assert(is_valid_reference(reference));
    self._back_references = _.reject(self._back_references, function (r) {
        return same_reference(r, reference);
    });
};

BaseNode.prototype._add_backward_reference = function (reference) {

    var self = this;
    assert(is_valid_reference(reference));
    // make sure we keep reference integrity
    //xx SLOW !!! assert((find_reference(self._back_references, reference).length === 0) && " reference exists already in _back_references");
    if (find_reference(self._references, reference).length > 0) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <Reference>
        //  in this case there is nothing to do
        return;
    }

    self._back_references.push(reference);

};

var displayWarningReferencePointingToItsef = true;

function _propagate_ref(self, address_space, reference) {

    // filter out non  Hierarchical References
    var referenceType = address_space.findReferenceType(reference.referenceType);

    if (!referenceType) {
        console.log(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
    }
    //xx if (!referenceType.isSupertypeOf(hierarchicalReferencesId)) { return; }
    var related_node = address_space.findObject(reference.nodeId);
    if (related_node) {

        // verify that reference doesn't point to object itself (see mantis 3099)
        if (reference.nodeId.toString() === self.nodeId.toString()) {
            if (displayWarningReferencePointingToItsef) {
                // this could happen with method
                console.log("  Warning: a Reference is pointing to itself ", self.nodeId.toString(), self.browseName.toString());
                displayWarningReferencePointingToItsef = false;
            }
        }
        //xx ignore this assert(reference.nodeId.toString() !== self.nodeId.toString());

        //function w(s,l) { return (s+"                                                          ").substr(0,l);}
        //if (reference.isForward) {
        //    console.log("  CHILD => ",w(related_node.browseName   + " " + related_node.nodeId.toString(),30),
        //        "  PARENT   ",w(self.browseName + " " + self.nodeId.toString(),30) , reference.toString());
        //} else {
        //    console.log("  CHILD => ",w(self.browseName   + " " + self.nodeId.toString(),30),
        //        "  PARENT   ",w(related_node.browseName + " " + related_node.nodeId.toString(),30) , reference.toString());
        //
        //}
        related_node._add_backward_reference(new Reference({
            referenceType: reference.referenceType,
            isForward: !reference.isForward,
            nodeId: self.nodeId
        }));

    } // else address_space may be incomplete
}
/**
 * this methods propagates the forward references to the pointed node
 * by inserting backward references to the counter part node
 *
 * @method propagate_back_references
 * @param address_space {AddressSpace}
 */
BaseNode.prototype.propagate_back_references = function (address_space) {

    var self = this;

    self._references.forEach(function (reference) {
        _propagate_ref(self, address_space, reference);
    });
};

/**
 * @method addReference
 * @param reference
 * @param reference.referenceType {String}
 * @param reference.isForward {Boolean}
 * @param reference.nodeId {NodeId|String}
 */
BaseNode.prototype.addReference = function (reference) {
    var self = this;
    reference = normalizeReferenceTypes(this.__address_space, reference);
    _propagate_ref(self, self.__address_space, reference);
    self._references.push(reference);
};

/**
 * Undo the effect of propagate_back_references
 * @method unpropagate_back_references
 * @param address_space
 * @private
 */
BaseNode.prototype.unpropagate_back_references = function (address_space) {

    var self = this;
    //xx assert(address_space instanceof AddressSpace);
    self._references.forEach(function (reference) {

        // filter out non  Hierarchical References
        var referenceType = address_space.findReferenceType(reference.referenceType);

        if (!referenceType) {
            console.log(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
        }
        var related_node = address_space.findObject(reference.nodeId);
        if (related_node) {
            assert(reference.nodeId.toString() !== self.nodeId.toString());
            related_node._remove_backward_reference({
                referenceType: reference.referenceType,
                isForward: !reference.isForward,
                nodeId: self.nodeId
            });
        } // else address_space may be incomplete
    });
};


BaseNode.prototype.getWriteMask = function () {
    return 0;
};

BaseNode.prototype.getUserWriteMask = function () {
    return 0;
};
/**
 * @method readAttribute
 * @param attributeId {AttributeId}
 * @return {DataValue}
 */
BaseNode.prototype.readAttribute = function (attributeId) {

    var options = {};
    options.statusCode = StatusCodes.Good;
    switch (attributeId) {

        case AttributeIds.NodeId:  // NodeId
            options.value = {dataType: DataType.NodeId, value: this.nodeId};
            break;

        case AttributeIds.NodeClass: // NodeClass
            assert(_.isFinite(this.nodeClass.value));
            options.value = {dataType: DataType.Int32, value: this.nodeClass.value};
            break;

        case AttributeIds.BrowseName: // QualifiedName
            assert(this.browseName instanceof QualifiedName);
            options.value = {dataType: DataType.QualifiedName, value: this.browseName};
            break;

        case AttributeIds.DisplayName: // LocalizedText
            options.value = {dataType: DataType.LocalizedText, value: this.displayName[0]};
            break;

        case AttributeIds.Description: // LocalizedText
            options.value = {dataType: DataType.LocalizedText, value: this.description};
            break;

        case AttributeIds.WriteMask:
            options.value = {dataType: DataType.UInt32, value: this.getWriteMask()};
            break;

        case AttributeIds.UserWriteMask:
            options.value = {dataType: DataType.UInt32, value: this.getUserWriteMask()};
            break;

        default:
            options.value = null;
            console.log("class Name ", this.constructor.name, (" BaseNode : '" + this.browseName + "' nodeid=" + this.nodeId.toString()).yellow, " cannot get attribute ", AttributeNameById[attributeId], "(", attributeId, ")");
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
            break;
    }
    //xx options.serverTimestamp = new Date();
    return new DataValue(options);
};

/**
 * @method writeAttribute
 * @param writeValue
 * @param writeValue.attributeId {AttributeId}
 * @param writeValue.dataValue {DataValue}
 * @param writeValue.indexRange {NumericRange}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 */
BaseNode.prototype.writeAttribute = function (writeValue, callback) {

    assert(_.isFunction(callback));
    if (writeValue.attributeId <= 0 || writeValue.attributeId > AttributeIds.UserExecutable) {
        return callback(null, StatusCodes.BadAttributeIdInvalid);
    }
    // by default Node is read-only,
    // this method needs to be overridden to change the behavior
    callback(null, StatusCodes.BadNotWritable);
};


/**
 * @method full_name
 * @return {String} the full path name of the node
 *
 */
BaseNode.prototype.full_name = function () {
    if (this.parentNodeId) {
        var parent = this.__address_space.findObject(this.parentNodeId);
        if (parent) {
            return parent.full_name() + "." + this.browseName.toString() + "";
        } else {
            return "NOT YET REGISTERED" + this.parentNodeId.toString() + "." + this.browseName.toString() + "";
        }
    }
    return this.browseName.toString();
};


/**
 * @method browseNodeByTargetName
 * @param relativePath
 * @param relativePath.targetName {QualifiedName}
 * @param relativePath.targetName.name {String}
 * @param relativePath.targetName.namespaceIndex {UInt32}
 * @param relativePath.referenceTypeId {NodeId}
 * @param relativePath.isInverse {Boolean}
 * @param relativePath.includeSubtypes {Boolean}
 * @return {NodeId[]}
 */
BaseNode.prototype.browseNodeByTargetName = function (relativePath) {
    var self = this;

    assert(relativePath.targetName instanceof QualifiedName);
    assert(relativePath.targetName.namespaceIndex >= 0);
    assert(relativePath.targetName.name.length > 0);
    assert(relativePath.hasOwnProperty("referenceTypeId"));
    assert(relativePath.hasOwnProperty("isInverse"));
    assert(relativePath.hasOwnProperty("includeSubtypes"));

    var references = self._references.concat(self._back_references);

    var nodeIds = [];
    references.forEach(function (reference) {
        var referenceTypeId = self.__address_space.findReferenceType(reference.referenceType).nodeId;
        assert(referenceTypeId instanceof NodeId);

        var obj = self.__address_space.findObject(reference.nodeId);

        if (!obj) {
            throw new Error(" cannot find node with id ", reference.nodeId.toString());
        }

        if (_.isEqual(obj.browseName, relativePath.targetName)) { // compare QualifiedName
            nodeIds.push(obj.nodeId);
        }
    });
    if (self.subtypeOf) {
        // browsing a InstanceDeclaration inclused browsing base type
        var baseType = self.__address_space.findObject(self.subtypeOf);
        var n = baseType.browseNodeByTargetName(relativePath);
        nodeIds = [].concat(nodeIds, n);
    }
    return nodeIds;
};

var check_flag = require("lib/misc/utils").check_flag;
var rm = ResultMask;

var _makeReferenceDescription = function (address_space, reference, resultMask) {

    var isForward = reference.isForward;

    var referenceTypeId = address_space.findReferenceType(reference.referenceType).nodeId;
    assert(referenceTypeId instanceof NodeId);

    var obj = address_space.findObject(reference.nodeId);

    var data = {};

    if (!obj) {
        // cannot find reference node
        data = {
            referenceTypeId: check_flag(resultMask, rm.ReferenceType) ? referenceTypeId : null,
            isForward: isForward,
            nodeId: reference.nodeId
        };
    } else {
        assert(reference.nodeId, obj.nodeId);
        data = {
            referenceTypeId: check_flag(resultMask, rm.ReferenceType) ? referenceTypeId : null,
            isForward: check_flag(resultMask, rm.IsForward) ? isForward : false,
            nodeId: obj.nodeId,
            browseName: check_flag(resultMask, rm.BrowseName) ? coerceQualifyName(obj.browseName) : null,
            displayName: check_flag(resultMask, rm.DisplayName) ? coerceLocalizedText(obj.displayName[0]) : null,
            nodeClass: check_flag(resultMask, rm.NodeClass) ? obj.nodeClass : NodeClass.Unspecified,
            typeDefinition: check_flag(resultMask, rm.TypeDefinition) ? obj.hasTypeDefinition : null
        };
    }
    if (data.typeDefinition === null) {
        data.typeDefinition = resolveNodeId("i=0");
    }
    var referenceDescription = new browse_service.ReferenceDescription(data);
    //xx console.log("typeDefinition",referenceDescription.typeDefinition);
    return referenceDescription;
};

function _constructReferenceDescription(address_space, references, resultMask) {
    //x assert(address_space instanceof AddressSpace);
    assert(_.isArray(references));
    return references.map(function (reference) {
        return _makeReferenceDescription(address_space, reference, resultMask);
    });
}

function referenceTypeToString(address_space, referenceTypeId) {

    if (!referenceTypeId) {
        return "<null> ";
    } else {
        var referenceType = address_space.findObject(referenceTypeId);
        return referenceTypeId.toString() + " " + referenceType.browseName.toString() + "/" + referenceType.inverseName.text;
    }
}

function nodeIdInfo(address_space, nodeId) {

    var obj = address_space.findObject(nodeId);
    var name = obj ? obj.browseName.toString() : " <????>";
    return nodeId.toString() + " [ " + name + " ]";

}
function dumpReferenceDescription(address_space, referenceDescription) {

    assert(address_space.constructor.name === "AddressSpace");
    //assert(address_space instanceof AddressSpace);
    assert(referenceDescription.referenceTypeId); // must be known;

    console.log("referenceDescription".red);
    console.log("    referenceTypeId : ", referenceTypeToString(address_space, referenceDescription.referenceTypeId));
    console.log("    isForward       : ", referenceDescription.isForward ? "true" : "false");
    console.log("    nodeId          : ", nodeIdInfo(address_space, referenceDescription.nodeId));
    console.log("    browseName      : ", referenceDescription.browseName.toString());
    console.log("    nodeClass       : ", referenceDescription.nodeClass.toString());
    console.log("    typeDefinition  : ", nodeIdInfo(address_space, referenceDescription.typeDefinition));

}
function dumpReferenceDescriptions(address_space, referenceDescriptions) {
    assert(address_space);
    assert(address_space.constructor.name === "AddressSpace");
    assert(_.isArray(referenceDescriptions));
    referenceDescriptions.forEach(function (r) {
        dumpReferenceDescription(address_space, r);
    });
}
exports.dumpReferenceDescription = dumpReferenceDescription;
exports.dumpReferenceDescriptions = dumpReferenceDescriptions;

function nodeid_is_nothing(nodeid) {
    return ( nodeid.value === 0 && nodeid.namespace === 0);
}

/**
 * @method normalize_referenceTypeId
 * @param address_space {AddressSpace}
 * @param referenceTypeId {String|NodeId|null} : the referenceType either as a string or a nodeId
 * @return {NodeId}
 */
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
    var nodeId;
    try {
        nodeId = address_space.resolveNodeId(referenceTypeId);
    }
    catch (err) {
        console.log("cannot normalize_referenceTypeId", referenceTypeId);
        throw err;
    }
    assert(nodeId);
    return nodeId;
}

function dumpBrowseDescription(node, browseDescription) {

    var address_space = node.__address_space;

    console.log(" Browse Node :");
    if (browseDescription.nodeId) {
        console.log(" nodeId : ", browseDescription.nodeId.toString().cyan);

    }
    console.log(" nodeId : ", node.browseName.toString().cyan, "(", node.nodeId.toString(), ")");
    console.log("   referenceTypeId :", referenceTypeToString(address_space, browseDescription.referenceTypeId));

    console.log("   browseDirection :", browseDescription.browseDirection.toString().cyan);
    console.log("   includeSubType  :", browseDescription.includeSubtypes ? "true" : "false");
    console.log("   nodeClassMask   :", browseDescription.nodeClassMask);
    console.log("   resultMask      :", browseDescription.resultMask);
}

/**
 * @method dumpReferences
 * @param address_space    {AddressSpace}
 * @param references  {Array<Reference>||null}
 * @static
 */
function dumpReferences(address_space, references) {

    assert(address_space);
    assert(_.isArray(references));


    references.forEach(function (reference) {

        var ref = address_space.findObject(reference.referenceType);
        if (!ref) {
            // unknown type ... this may happen when the address space is not fully build
            return;
        }
        var dir = reference.isForward ? "(=>)" : "(<-)";
        var objectName = nodeIdInfo(address_space, reference.nodeId);

        console.log(" referenceType : ", dir, ref ? ref.browseName.toString() : reference.referenceType.toString(), " ", objectName);
    });
}

exports.dumpBrowseDescription = dumpBrowseDescription;
exports.dumpReferences = dumpReferences;


function _filter_by_referenceType(self, browseDescription, references, referenceTypeId) {
    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {
        assert(referenceTypeId instanceof NodeId);
        var referenceType = self.__address_space.findObject(referenceTypeId);
        dumpIf(!referenceType, referenceTypeId);
        assert(referenceType instanceof ReferenceType);

        references = references.filter(function (reference) {

            // xxx if (reference.referenceType === "HasSubtype"){ return false;  }

            var ref = self.__address_space.findObject(reference.referenceType);
            if (!ref) {
                return false;
            } // unknown type ... this may happen when the address space is not fully build
            dumpIf(!ref, reference);
            assert(ref instanceof ReferenceType);

            var is_of_type = ref.nodeId.toString() === referenceType.nodeId.toString();
            if (browseDescription.includeSubtypes) {
                return ref.isSupertypeOf(referenceType) || is_of_type;
            } else {
                return is_of_type;
            }
        });
    }
    return references;
}

function forwardOnly(reference) {
    return reference.isForward;
}

function reverseOnly(reference) {
    return !reference.isForward;
}

function _filter_by_direction(references, browseDirection) {

    if (browseDirection === BrowseDirection.Both) {
        return references;
    }
    if (browseDirection === BrowseDirection.Forward) {
        return references.filter(forwardOnly);
    } else {
        return references.filter(reverseOnly);
    }
}


function _filter_by_nodeclass(self, references, nodeClassMask) {

    assert(_.isFinite(nodeClassMask));
    if (nodeClassMask === 0) {
        return references;
    }
    var address_space = self.__address_space;
    return references.filter(function (reference) {

        var obj = address_space.findObject(reference.nodeId);

        if (!obj) {
            return false;
        }

        var nodeClassName = obj.nodeClass.key;

        var value = browse_service.makeNodeClassMask(nodeClassName);
        return (value & nodeClassMask ) === value;

    });
}

/**
 * browse the node to extract information requested in browseDescription
 * @method browseNode
 * @param browseDescription {BrowseDescription}
 * @return {ReferenceDescription[]}
 */
BaseNode.prototype.browseNode = function (browseDescription) {

    assert(_.isFinite(browseDescription.nodeClassMask));
    assert(_.isObject(browseDescription.browseDirection));

    var do_debug = false;

    //xx do_debug = ( this.browseName === "Server" );

    var self = this;

    /* istanbul ignore next */
    if (do_debug) {
        var references = self._clone_references();

        dumpBrowseDescription(self, browseDescription);
    }

    var referenceTypeId = normalize_referenceTypeId(this.__address_space, browseDescription.referenceTypeId);
    assert(referenceTypeId instanceof NodeId);

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    var address_space = self.__address_space;

    // get all possible references
    references = self._references.concat(self._back_references);

    /* istanbul ignore next */
    if (do_debug) {
        console.log("all references :", self.nodeId.toString(), self.browseName.toString());
        dumpReferences(address_space, self._references);
    }

    // filter out references not matching referenceType
    references = _filter_by_referenceType(self, browseDescription, references, referenceTypeId);

    references = _filter_by_direction(references, browseDirection);

    references = _filter_by_nodeclass(self, references, browseDescription.nodeClassMask);

    var referenceDescriptions = _constructReferenceDescription(address_space, references, browseDescription.resultMask);

    /* istanbul ignore next */
    if (do_debug) {
        dumpReferenceDescriptions(self.__address_space, referenceDescriptions);
    }

    return referenceDescriptions;
};

function install_components_as_object_properties(parentObj) {

    if (!parentObj) {
        return;
    }
    //xx console.log("xxxx install_components_as_object_properties on ".yellow,parentObj.browseName);

    var a1 = parentObj.findReferencesAsObject("Organizes");
    var a2 = parentObj.findReferencesAsObject("HasComponent");
    var a3 = parentObj.findReferencesAsObject("HasProperty");
    var children = a1.concat(a2, a3);

    children.forEach(function (child) {

        if (!child) {
            return;
        }
        var name = lowerFirstLetter(child.browseName.toString());
        //xx console.log("xxxx Installating property : ".yellow,name);

        /* istanbul ignore next */
        if (parentObj.hasOwnProperty(name)) {
            //xx console.log(" parent has already a property named " + name);
            return;
            //xx throw new Error(" parent has already a property named "+name);
        }
        //xxx console.log(parentObj.browseName + " adding property "+name);

        Object.defineProperty(parentObj, name, {
            enumerable: true,
            configurable: false,
            //xx writable: false,
            get: function () {
                return child;
            }
            //value: child
        });
    });
}

//BaseNode.prototype.install_extra_properties_ = function () {
//    install_components_as_object_properties(this);
//};
//

BaseNode.prototype.install_extra_properties = function () {

    var self = this;

    install_components_as_object_properties(self);

    var address_space = self.__address_space;

    function install_extra_properties_on_parent(ref) {
        var o = address_space.findObject(ref.nodeId);
        //xx console.log("installing property on ",ref.toString());
        install_components_as_object_properties(o);
    }

    // make sure parent have extra properties updated
    var components = self.findReferences("HasComponent", false);
    var subfolders = self.findReferences("Organizes", false);
    var properties = self.findReferences("HasProperty", false);
    var rf = [].concat(components, subfolders, properties);
    //xx console.log("xxxxx ".yellow,rf);
    rf.forEach(install_extra_properties_on_parent);


};


function _clone_collection(collection, references, referenceType) {

    collection.forEach(function (node) {
        // ensure node is of the correct type,
        // it may happen that the xmlnodeset2 file was malformed
        if (!_.isFunction(node.clone)) {
            console.log("Warning : cannot clone node " + node.browseName.toString() + " of class " + node.nodeClass.toString());
            return;
        }
        var clone = node.clone();
        references.push({referenceType: referenceType, isForward: true, nodeId: clone.nodeId});
    });

}

/**
 * clone properties and methods
 * @method _clone_references
 * @return {Array}
 * @private
 */
BaseNode.prototype._clone_references = function () {

    var self = this;
    var references = [];


    // now create instance members - HasComponent
    var components = self.getComponents();
    _clone_collection(components, references, "HasComponent");


    // now create instance members - HasProperty
    var properties = self.getProperties();
    _clone_collection(properties, references, "HasProperty");

    assert(references.length === components.length + properties.length);

    if (self.hasTypeDefinition) {
        references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: self.hasTypeDefinition});
    }
    return references;
};

/**
 * @method _clone
 * @param Constructor {Function}
 * @param options {Object}
 * @return {*}
 * @private
 */
BaseNode.prototype._clone = function (Constructor, options) {

    var self = this;

    var references = self._clone_references();


    var new_node_id = self.__address_space._build_new_NodeId();

    options = _.extend(options, {
        address_space: self.__address_space,
        nodeId: new_node_id,
        references: references,
        browseName: self.browseName,
        displayName: self.displayName,
        description: self.description
        //
    });
    assert(options.nodeId instanceof NodeId);

    var cloneObj = new Constructor(options);

    self.__address_space._register(cloneObj);

    cloneObj.install_extra_properties();

    return cloneObj;

};

function indent(str) {
    return str.split("\n").map(function (r) {
        return "         " + r;
    }).join("\n");
}
BaseNode.prototype.toString = function (options) {

    if (!!options) {
        assert(_.isObject(options.cycleDetector));
    }
    options = options || {};
    options.padding = options.padding || " ";

    options.cycleDetector = options.cycleDetector || {};

    var self = this;
    var str = [];

    function set_as_processed(nodeId) {
        assert(nodeId instanceof NodeId);
        options.cycleDetector[nodeId.toString()] = nodeId;
    }

    set_as_processed(self.nodeId);

    function is_already_processed(nodeId) {
        return !!options.cycleDetector[nodeId.toString()];
    }

    function add(s) {
        str.push(s);
    }

    add("");
    add(options.padding + "          nodeId        : ".yellow + self.nodeId.toString());
    add(options.padding + "          nodeClass     : ".yellow + self.nodeClass.toString());
    add(options.padding + "          browseName    : ".yellow + self.browseName.toString());
    add(options.padding + "          displayName   : ".yellow + self.displayName.map(function (f) {
            return f.locale + " " + f.text;
        }).join(" | "));
    add(options.padding + "             description: ".yellow + (self.description ? self.description.toString() : ""));


    if (self.dataType) {
        add(options.padding + "                dataType: ".yellow + self.dataType);
    }
    if (self._dataValue) {
        add(options.padding + "                   value: ".yellow + "\n" + indent(self._dataValue.toString()));
    }
    if (self.subtypeOfObj) {
        add(options.padding + "               subtypeOf: ".yellow + " " + self.subtypeOfObj.nodeId.toString() + " " + self.subtypeOfObj.browseName.toString());
    }
    if (self.typeDefinitionObj) {
        add(options.padding + "          typeDefinition: ".yellow + " " + self.typeDefinitionObj.nodeId.toString() + " " + self.typeDefinitionObj.browseName.toString());
    }

    if (self.accessLevel) {
        add(options.padding + "             accessLevel: ".yellow + " " + self.accessLevel.toString());
    }
    if (self.userAccessLevel) {
        add(options.padding + "         userAccessLevel: ".yellow + " " + self.userAccessLevel.toString());
    }
    if (self.minimumSamplingInterval !== undefined) {
        add(options.padding + " minimumSamplingInterval: ".yellow + " " + self.minimumSamplingInterval.toString() + " ms");
    }

    var r = [].concat(self._references, self._back_references);
    add(options.padding + "   references   : ".yellow + " " + r.length);


    r.forEach(function (reference) {
        if (!reference.isForward) {
            return;
        }
        var o = self.__address_space.findObject(reference.nodeId);
        var name = o ? o.browseName.toString() : "<???>";
        add(options.padding + "    +-> ".yellow + reference.toString() + " " + name.cyan);
        if (reference.referenceType === "HasTypeDefinition" && reference.nodeId.namespace === 0) {
            return;
        }
        if (o) {
            if (!is_already_processed(o.nodeId)) {
                set_as_processed(o.nodeId);
                var rr = o.toString({padding: options.padding + "      ", cycleDetector: options.cycleDetector});
                add(rr);
            }
        }

    });


    //r.forEach(function(reference) {
    //    if (!reference.isForward) {  return; }
    //    if (reference.referenceType === "HasTypeDefinition") {
    //        return;
    //    }
    //    var o = self.__address_space.findObject(reference.nodeId);
    //    add(options.padding +"   " + o.browseName.yellow );
    //    var rr = o.toString({padding: options.padding + "   "});
    //    add(rr);
    //});

    return str.join("\n");
};

exports.BaseNode = BaseNode;
ReferenceType = require("lib/address_space/referenceType").ReferenceType;
