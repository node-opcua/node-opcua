"use strict";

/*jslint bitwise: true */
/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var util = require("util");
var utils = require("lib/misc/utils");

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

exports.BrowseDirection = BrowseDirection;

var assert = require("better-assert");
var _ = require("underscore");
var dumpIf = require("lib/misc/utils").dumpIf;
var ReferenceType = null;// will be defined after baseNode is defined

var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;
var capitalizeFirstLetter = require("lib/misc/utils").capitalizeFirstLetter;


var Reference = require("lib/address_space/reference").Reference;


function same_reference(r1, r2) {
    assert(r1 instanceof Reference);
    assert(r2 instanceof Reference);
    //xx assert(is_valid_reference(r1));
    //xx assert(is_valid_reference(r2));
    return r1.referenceType === r2.referenceType &&
        r1.nodeId.toString() === r2.nodeId.toString();
}

function find_reference(referenceArray, referenceToFind) {
    assert(_.isArray(referenceArray));
    assert(referenceToFind instanceof Reference);
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
 * will assert, for instance, if a referenceType is given by it's inverse name.
 * @method _check_reference_type_validity
 * @param addressSpace {AddressSpace}
 * @param references {Array<reference>}
 *
 * @private
 */
function _check_reference_type_validity(addressSpace, references) {
    // assert( addressSpace instanceof AddressSpace);
    _.forEach(references, function (reference) {

        assert(reference instanceof Reference);
        //xx assert(is_valid_reference(reference));
        if (reference.referenceType === "HasSubtype" || reference.referenceType === "HasTypeDefinition") {
            return; // this reference type is known to be correct
        }

        var ref = addressSpace.findReferenceType(reference.referenceType);

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
 * @param options.addressSpace {AddressSpace}
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
    assert(options.addressSpace); // expecting an address space
    options.references = options.references || [];

    // this.__address_space = options.addressSpace;
    // make address space non enumerable
    Object.defineProperty(this, "__address_space", {configurable: true,value: options.addressSpace, enumerable: false});

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
    this._references = this.__address_space.normalizeReferenceTypes(options.references);

    this._back_references = [];

    this._cache = {};

    _setup_parent_item.call(this, options.references);

}
util.inherits(BaseNode, EventEmitter);

Object.defineProperty(BaseNode.prototype, "__address_space", {
    writable: true,
    hidden: true,
    enumerable: false
});

BaseNode.Reference = Reference;


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

BaseNode.prototype.getDisplayName = function(locale) {
    return this.__displayName[0].text;
};

/**
 * @property description
 * @type LocalizedText
 */
Object.defineProperty(BaseNode.prototype, "__description", {writable: true, hidden: true, enumerable: false});

BaseNode.prototype._setDescription = function (description) {

    this.__description = coerceLocalizedText(description);
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


function _is_valid_BrowseDirection(browseDirection) {
    return  browseDirection === BrowseDirection.Forward ||
            browseDirection === BrowseDirection.Inverse ||
            browseDirection === BrowseDirection.Both
        ;
}

/**
 * find all references that have the provided referenceType or are subType of this referenceType
 * @method findReferencesEx
 * @param strReference {String} the referenceType as a string.
 * @param  [browseDirection=BrowseDirection.Forward] {BrowseDirection}
 * @return {Array<ReferenceDescription>}
 */
BaseNode.prototype.findReferencesEx = function (strReference, browseDirection)
{
    browseDirection = browseDirection || BrowseDirection.Forward;
    assert(_is_valid_BrowseDirection(browseDirection));

    var addressSpace = this.__address_space;

    var referenceId = addressSpace.findReferenceType(strReference);
    if (!referenceId) {
        // note: when loading nodeset2.xml files, reference type may not exit yet
        // throw new Error("expecting valid reference name " + strReference);
        return [];
    }

    if (referenceId) {
        assert(referenceId.nodeId instanceof NodeId);

        var browseResults = this.browseNode({
            browseDirection: browseDirection,
            referenceTypeId: referenceId.nodeId,
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: 0x3F
        });
        return browseResults;
    } else {
        return [];
    }
};
/**
 * @method findReferences
 * @param strReference {String} the referenceType as a string.
 * @param  [isForward=true] {Boolean}
 * @return {Array<Reference>}
 */
BaseNode.prototype.findReferences = function (strReference, isForward) {

    isForward = utils.isNullOrUndefined(isForward) ? true : !!isForward;

    assert(_.isString(strReference));
    assert(_.isBoolean(isForward));

    // istanbul ignore next
    if (!(this.__address_space.findReferenceType(strReference))) {
        throw new Error("expecting valid reference name " + strReference);
    }

    assert(this._references);
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



function toString_ReferenceDescription(ref,options) {

    var addressSpace = options.addressSpace;
    //xx assert(ref instanceof ReferenceDescription);
    var r = new Reference({
        referenceType: addressSpace.findNode(ref.referenceTypeId).browseName.toString(),
        nodeId:        ref.nodeId,
        isForward:     ref.isForward
    });
    return r.toString(options);
}

/* jshint latedef: false */
function _setup_parent_item(references) {
    /* jshint validthis: true */
    assert(this instanceof BaseNode);
    assert(_.isArray(references));
    assert(!this._cache.parent && "_setup_parent_item has been already called");

    var addressSpace = this.__address_space;

    if (references.length > 0) {

        var browseResults = this.findReferencesEx("HasChild",BrowseDirection.Inverse);

        if (browseResults.length >= 1) {
            // istanbul ignore next
            if (browseResults.length > 1) {

                if (displayWarning) {

                    var options = { addressSpace: addressSpace};
                    console.log("  More than one HasChild reference have been found for parent of object");
                    console.log("    object node id:", this.nodeId.toString(), this.browseName.toString().cyan);
                    console.log("    browseResults:");
                    console.log(browseResults.map(function (f) {return toString_ReferenceDescription(f,options);}).join("\n"));
                    console.log("    first one will be used as parent");
                    //xx assert(browseResults.length === 1);
                    displayWarning = false;
                }
            }
            this._cache.parent = addressSpace.findNode(browseResults[0].nodeId);
        }
    }
}


BaseNode.prototype.findReferencesAsObject = function (strReference, isForward) {

    var componentsIds = this.findReferences(strReference, isForward);
    var addressSpace = this.__address_space;

    function toObject(reference) {
        var obj = addressSpace.findNode(reference.nodeId);

        // istanbul ignore next
        if (false && !obj) {
            console.log(" Warning :  object with nodeId ".red + reference.nodeId.toString().cyan + " cannot be found in the address space !".red);
        }
        return obj;
    }

    function remove_null(o) { return !!o; }
    return componentsIds.map(toObject).filter(remove_null);
};


/**
 * returns the nodeId of this node's Type Definition
 * @property typeDefinition
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("typeDefinition", function () {
    if (!this._cache.typeDefinition) {
        var has_type_definition_ref = this.findReference("HasTypeDefinition", true);
        this._cache.typeDefinition = has_type_definition_ref ? has_type_definition_ref.nodeId : null;
    }
    return this._cache.typeDefinition;
});


/**
 * returns the nodeId of this node's Type Definition
 * @property typeDefinitionObj
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
    if (!this._cache._components) {
        this._cache._components = this.findReferencesAsObject("HasComponent", true);
    }
    return this._cache._components;
};
/**
 * @method getProperties
 * @return {BaseNode[]} return a array with the properties of this object.
 */
BaseNode.prototype.getProperties = function () {
    if (!this._cache._properties) {
        this._cache._properties = this.findReferencesAsObject("HasProperty", true);
    }
    return this._cache._properties;
};

/**
 * retrieve a component by name
 * @method getComponentByName
 * @param browseName
 * @return {BaseNode|null}
 */
BaseNode.prototype.getComponentByName = function (browseName) {
    assert(typeof browseName === "string");
    var components = this.getComponents();
    var select = components.filter(function (c) {
        return c.browseName.toString() === browseName;
    });
    assert(select.length <=1, "BaseNode#getComponentByName found duplicated reference");
    return select.length === 1 ? select[0] : null;
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
    assert(select.length <=1, "BaseNode#getPropertyByName found duplicated reference");
    return select.length === 1 ? select[0] : null;
};


BaseNode.prototype.getFolderElementByName = function(browseName) {
    assert(typeof browseName === "string");
    var elements = this.getFolderElements();
    var select = elements.filter(function (c) {
        return c.browseName.toString() === browseName;
    });
    return select.length === 1 ? select[0] : null;
};

/**
 * returns the list of nodes that this folder object organizes
 * @method getFolderElements
 * @return {Array<UAObject>}
 *
 */
BaseNode.prototype.getFolderElements = function() {
    return this.findReferencesAsObject("Organizes", true);
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

    if (!this._cache._methods) {
        var components = this.getComponents();
        var UAMethod = require("lib/address_space/ua_method").UAMethod;
        this._cache._methods = components.filter(function (obj) {
            return obj instanceof UAMethod;
        });
    }
    return this._cache._methods;
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
 * returns the nodeId of the Type which is the super type of this
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


BaseNode.prototype.__findReferenceWithBrowseName = function(referenceType,browseName) {
    var refs = this.findReferencesAsObject(referenceType);

    function hasBrowseName(node) {
        return node.browseName.toString() === browseName;
    }
    var ref = refs.filter(hasBrowseName)[0];
    return ref;
};


/**
 * @property namespaceIndex
 * @type {Number}
 */
BaseNode.prototype.__defineGetter__("namespaceIndex", function () {
   return this.nodeId.namespace;
});

/**
 * @property namespaceUri
 * @type {String}
 */
BaseNode.prototype.__defineGetter__("namespaceUri", function () {
    if (!this._cache.namespaceUri) {
        this._cache.namespaceUri = this.__address_space.getNamespaceUri(this.namespaceIndex);
    }
    return this._cache.namespaceUri;
});

/**
 * the parent node
 * @property parent
 * @type {BaseNode}
 */
BaseNode.prototype.__defineGetter__("parent", function () {
    if (this._cache.parent === undefined) {
        _setup_parent_item.call(this, this._references);
    }
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
    assert(reference instanceof Reference);
    //xx assert(is_valid_reference(reference));
    self._back_references = _.reject(self._back_references, function (r) {
        return same_reference(r, reference);
    });
};

BaseNode.prototype._add_backward_reference = function (reference) {

    var self = this;
    assert(reference instanceof Reference);
    //xx assert(Reference.is_valid_reference(reference));

    // make sure we keep reference integrity
    //xx SLOW !!! assert((find_reference(self._back_references, reference).length === 0) && " reference exists already in _back_references");
    if (find_reference(self._references, reference).length > 0) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <Reference>
        //  in this case there is nothing to do
        return;
    }

    self._back_references.push(reference);
    self._clear_caches();

};

var displayWarningReferencePointingToItsef = true;

function _propagate_ref(self, addressSpace, reference) {

    // filter out non  Hierarchical References
    var referenceType = addressSpace.findReferenceType(reference.referenceType);

    // istanbul ignore next
    if (!referenceType) {
        console.log(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
    }

    //xx if (!referenceType.isSupertypeOf(hierarchicalReferencesId)) { return; }
    var related_node = addressSpace.findNode(reference.nodeId);
    if (related_node) {

        // verify that reference doesn't point to object itself (see mantis 3099)
        if (reference.nodeId.toString() === self.nodeId.toString()) {


            // istanbul ignore next
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

    } // else addressSpace may be incomplete
}
/**
 * this methods propagates the forward references to the pointed node
 * by inserting backward references to the counter part node
 *
 * @method propagate_back_references
 * @param addressSpace {AddressSpace}
 */
BaseNode.prototype.propagate_back_references = function () {

    var self = this;
    var addressSpace = self.__address_space;

    self._references.forEach(function (reference) {
        _propagate_ref(self, addressSpace, reference);
    });
};

/**
 * @method addReference
 * @param reference
 * @param reference.referenceType {String}
 * @param [reference.isForward =true] {Boolean}
 * @param reference.nodeId {Node|NodeId|String}
 *
 * @example
 *
 *     view.addReference({ referenceType: "Organizes", nodeId: myDevice });
 *
 * or
 *
 *     myDevice1.addReference({ referenceType: "OrganizedBy", nodeId: view });
 */
BaseNode.prototype.addReference = function (reference) {
    var self = this;

    assert(reference.hasOwnProperty("referenceType"));
    //xx isForward is optional : assert(reference.hasOwnProperty("isForward"));
    assert(reference.hasOwnProperty("nodeId"));

    var addressSpace = self.__address_space;
    reference = addressSpace.normalizeReferenceTypes([reference])[0];

    assert((find_reference(self._back_references, reference).length === 0) && " reference exists already in _back_references");
    assert((find_reference(self._references,      reference).length === 0) && " reference exists already in referernces");

    if (!addressSpace.findReferenceType(reference.referenceType)) {
        throw new Error("BaseNode#addReference : invalid reference " + reference.toString());
    }
    self._references.push(reference);

    self._clear_caches();
    self.propagate_back_references();
    self.install_extra_properties();

};

/**
 * Undo the effect of propagate_back_references
 * @method unpropagate_back_references
 * @private
 */
BaseNode.prototype.unpropagate_back_references = function () {

    var self = this;
    var addressSpace = self.__address_space;
    //xx assert(addressSpace instanceof AddressSpace);
    self._references.forEach(function (reference) {

        // filter out non  Hierarchical References
        var referenceType = addressSpace.findReferenceType(reference.referenceType);

        // istanbul ignore next
        if (!referenceType) {
            console.log(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
        }

        var related_node = addressSpace.findNode(reference.nodeId);
        if (related_node) {
            assert(reference.nodeId.toString() !== self.nodeId.toString());
            related_node._remove_backward_reference(new Reference({
                referenceType: reference.referenceType,
                isForward: !reference.isForward,
                nodeId: self.nodeId
            }));
        } // else addressSpace may be incomplete
    });
};

BaseNode.prototype._clear_caches = function() {
    var self = this;
    // clean caches
    self._cache = {};
};
BaseNode.prototype._on_child_added = function(/*obj*/) {
    var self = this;
    self._clear_caches();
};

BaseNode.prototype._on_child_removed = function(/*obj*/) {
    var self = this;
    self._clear_caches();
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
 * @param [indexRange {NumericRange}]
 * @param [dataEncoding {String}]
 * @return {DataValue}
 */
BaseNode.prototype.readAttribute = function (attributeId, indexRange, dataEncoding) {

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
            //xx debugLog("class Name ", this.constructor.name, (" BaseNode : '" + this.browseName + "' nodeid=" + this.nodeId.toString()).yellow, " cannot get attribute ", AttributeNameById[attributeId], "(", attributeId, ")");
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
        var parent = this.__address_space.findNode(this.parentNodeId);

        // istanbul ignore else
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

        var obj = self.__address_space.findNode(reference.nodeId);

        // istanbul ignore next
        if (!obj) {
            throw new Error(" cannot find node with id ", reference.nodeId.toString());
        }

        if (_.isEqual(obj.browseName, relativePath.targetName)) { // compare QualifiedName
            nodeIds.push(obj.nodeId);
        }
    });
    if (self.subtypeOf) {
        // browsing also InstanceDeclarations included in base type
        var baseType = self.__address_space.findNode(self.subtypeOf);
        var n = baseType.browseNodeByTargetName(relativePath);
        nodeIds = [].concat(nodeIds, n);
    }
    return nodeIds;
};

var check_flag = require("lib/misc/utils").check_flag;
var rm = ResultMask;

var _makeReferenceDescription = function (addressSpace, reference, resultMask) {

    var isForward = reference.isForward;

    var referenceTypeId = addressSpace.findReferenceType(reference.referenceType).nodeId;
    assert(referenceTypeId instanceof NodeId);

    var obj = addressSpace.findNode(reference.nodeId);

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
            typeDefinition: check_flag(resultMask, rm.TypeDefinition) ? obj.typeDefinition : null
        };
    }
    if (data.typeDefinition === null) {
        data.typeDefinition = resolveNodeId("i=0");
    }
    var referenceDescription = new browse_service.ReferenceDescription(data);
    //xx console.log("typeDefinition",referenceDescription.typeDefinition);
    return referenceDescription;
};

function _constructReferenceDescription(addressSpace, references, resultMask) {
    //x assert(addressSpace instanceof AddressSpace);
    assert(_.isArray(references));
    return references.map(function (reference) {
        return _makeReferenceDescription(addressSpace, reference, resultMask);
    });
}

function referenceTypeToString(addressSpace, referenceTypeId) {

    //istanbul ignore next
    if (!referenceTypeId) {
        return "<null> ";
    } else {
        var referenceType = addressSpace.findNode(referenceTypeId);
        return referenceTypeId.toString() + " " + referenceType.browseName.toString() + "/" + referenceType.inverseName.text;
    }
}

function nodeIdInfo(addressSpace, nodeId) {

    var obj = addressSpace.findNode(nodeId);
    var name = obj ? obj.browseName.toString() : " <????>";
    return nodeId.toString() + " [ " + name + " ]";

}
function dumpReferenceDescription(addressSpace, referenceDescription) {

    assert(addressSpace.constructor.name === "AddressSpace");
    //assert(addressSpace instanceof AddressSpace);
    assert(referenceDescription.referenceTypeId); // must be known;

    console.log("referenceDescription".red);
    console.log("    referenceTypeId : ", referenceTypeToString(addressSpace, referenceDescription.referenceTypeId));
    console.log("    isForward       : ", referenceDescription.isForward ? "true" : "false");
    console.log("    nodeId          : ", nodeIdInfo(addressSpace, referenceDescription.nodeId));
    console.log("    browseName      : ", referenceDescription.browseName.toString());
    console.log("    nodeClass       : ", referenceDescription.nodeClass.toString());
    console.log("    typeDefinition  : ", nodeIdInfo(addressSpace, referenceDescription.typeDefinition));

}
function dumpReferenceDescriptions(addressSpace, referenceDescriptions) {
    assert(addressSpace);
    assert(addressSpace.constructor.name === "AddressSpace");
    assert(_.isArray(referenceDescriptions));
    referenceDescriptions.forEach(function (r) {
        dumpReferenceDescription(addressSpace, r);
    });
}
exports.dumpReferenceDescription = dumpReferenceDescription;
exports.dumpReferenceDescriptions = dumpReferenceDescriptions;

function nodeid_is_nothing(nodeid) {
    return ( nodeid.value === 0 && nodeid.namespace === 0);
}

/**
 * @method normalize_referenceTypeId
 * @param addressSpace {AddressSpace}
 * @param referenceTypeId {String|NodeId|null} : the referenceType either as a string or a nodeId
 * @return {NodeId}
 */
function normalize_referenceTypeId(addressSpace, referenceTypeId) {
    if (!referenceTypeId) {
        return makeNodeId(0);
    }
    if (typeof referenceTypeId === "string") {
        var ref = addressSpace.findReferenceType(referenceTypeId);
        if (ref) {
            return ref.nodeId;
        }
    }
    var nodeId;
    try {
        nodeId = addressSpace.resolveNodeId(referenceTypeId);
    }
    catch (err) {
        console.log("cannot normalize_referenceTypeId", referenceTypeId);
        throw err;
    }
    assert(nodeId);
    return nodeId;
}

function dumpBrowseDescription(node, browseDescription) {

    var addressSpace = node.__address_space;

    console.log(" Browse Node :");

    if (browseDescription.nodeId) {
        console.log(" nodeId : ", browseDescription.nodeId.toString().cyan);
    }

    console.log(" nodeId : ", node.browseName.toString().cyan, "(", node.nodeId.toString(), ")");
    console.log("   referenceTypeId :", referenceTypeToString(addressSpace, browseDescription.referenceTypeId));

    console.log("   browseDirection :", browseDescription.browseDirection.toString().cyan);
    console.log("   includeSubType  :", browseDescription.includeSubtypes ? "true" : "false");
    console.log("   nodeClassMask   :", browseDescription.nodeClassMask);
    console.log("   resultMask      :", browseDescription.resultMask);
}

/**
 * @method dumpReferences
 * @param addressSpace    {AddressSpace}
 * @param references  {Array<Reference>||null}
 * @static
 */
function dumpReferences(addressSpace, references) {

    assert(addressSpace);
    assert(_.isArray(references));


    references.forEach(function (reference) {

        var ref = addressSpace.findNode(reference.referenceType);
        if (!ref) {
            // unknown type ... this may happen when the address space is not fully build
            return;
        }
        var dir = reference.isForward ? "(=>)" : "(<-)";
        var objectName = nodeIdInfo(addressSpace, reference.nodeId);

        console.log(" referenceType : ", dir, ref ? ref.browseName.toString() : reference.referenceType.toString(), " ", objectName);
    });
}

exports.dumpBrowseDescription = dumpBrowseDescription;
exports.dumpReferences = dumpReferences;


function _filter_by_referenceType(self, browseDescription, references, referenceTypeId) {

    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {

        assert(referenceTypeId instanceof NodeId);
        var referenceType = self.__address_space.findNode(referenceTypeId);

        dumpIf(!referenceType, referenceTypeId);
        assert(referenceType instanceof ReferenceType);

        references = references.filter(function (reference) {

            // xxx if (reference.referenceType === "HasSubtype"){ return false;  }

            var ref = self.__address_space.findReferenceType(reference.referenceType);
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
    var addressSpace = self.__address_space;
    return references.filter(function (reference) {

        var obj = addressSpace.findNode(reference.nodeId);

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


    var referenceTypeId = normalize_referenceTypeId(this.__address_space, browseDescription.referenceTypeId);
    assert(referenceTypeId instanceof NodeId);

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    var addressSpace = self.__address_space;

    // get all possible references
    var references = self._references.concat(self._back_references);

    /* istanbul ignore next */
    if (do_debug) {
        console.log("all references :", self.nodeId.toString(), self.browseName.toString());
        dumpReferences(addressSpace, self._references);
    }

    // filter out references not matching referenceType
    references = _filter_by_referenceType(self, browseDescription, references, referenceTypeId);

    references = _filter_by_direction(references, browseDirection);

    references = _filter_by_nodeclass(self, references, browseDescription.nodeClassMask);

    var referenceDescriptions = _constructReferenceDescription(addressSpace, references, browseDescription.resultMask);

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

        // assumption: we ignore namespace here .
        var name = lowerFirstLetter(child.browseName.name.toString());
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

    var addressSpace = self.__address_space;

    function install_extra_properties_on_parent(ref) {
        var o = addressSpace.findNode(ref.nodeId);
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


function _clone_collection(newParent,collection,referenceType,optionalFilter, extraInfo) {

    collection.forEach(function (node) {
        // ensure node is of the correct type,
        // it may happen that the xmlnodeset2 file was malformed

        // istanbul ignore next
        if (!_.isFunction(node.clone)) {
            console.log("Warning : cannot clone node ".red + node.browseName.toString() + " of class " + node.nodeClass.toString());
            return;
        }

        if (optionalFilter) {
            assert(_.isFunction(optionalFilter));
            if (!optionalFilter(node)) {
                return ; // skip this node
            }
        }


        var options = {
            references: [
                {referenceType: referenceType, isForward: false, nodeId: newParent.nodeId}
            ]
        };

        var clone = node.clone(options,extraInfo);

        clone.propagate_back_references();

        if (extraInfo) {
            extraInfo.registerClonedObject(node,clone);
        }
    });
}

/**
 * clone properties and methods
 * @method _clone_children_references
 * @param newParent the new parent object to which references of type HasChild  will be attached
 * @param [optionalFilter {Function} = null] a filter
 * @param [extraInfo]
 * @return {Array}
 * @private
 */
BaseNode.prototype._clone_children_references = function (newParent,optionalFilter, extraInfo) {

    var self = this;

    assert(newParent instanceof BaseNode);

    // now create instance members - HasComponent
    var components = self.getComponents();
    _clone_collection(newParent,components, "HasComponent", optionalFilter, extraInfo);

    // now create instance members - HasProperty
    var properties = self.getProperties();
    _clone_collection(newParent,properties, "HasProperty", optionalFilter, extraInfo);

};

/**
 * @method _clone
 * @param Constructor {Function}
 * @param options {Object}
 * @return {*}
 * @private
 */
BaseNode.prototype._clone = function (Constructor, options, extraInfo) {

    var self = this;

    assert(_.isFunction(Constructor));
    assert(_.isObject(options));
    assert(!extraInfo || (_.isObject(extraInfo) && _.isFunction(extraInfo.registerClonedObject)));
    assert(!self.subtypeOf,"We do not cloning Type yet");

    options = _.extend(options, {
        addressSpace: self.__address_space,
        browseName:   self.browseName,
        displayName:  self.displayName,
        description:  self.description
    });
    options.references = options.references || [];
    if (self.typeDefinition) {
        options.references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: self.typeDefinition});
    }

    options.nodeId = self.__address_space._construct_nodeId(options);
    assert(options.nodeId instanceof NodeId);

    var cloneObj = new Constructor(options);
    self.__address_space._register(cloneObj);

    self._clone_children_references(cloneObj,/*optionalFilter*/null,extraInfo);

    cloneObj.install_extra_properties();

    return cloneObj;

};

function indent(str,padding) {
    padding = padding || "          ";
    return str.split("\n").map(function (r) {
        return padding + r;
    }).join("\n");
}



BaseNode.prototype.toString = function (options) {

    var str = [];
    var self = this;

    if (!! options ) {
        assert(_.isObject(options.cycleDetector));
    }
    options = options||{};
    function add(s) { str.push(s);     }
    options.add = add;
    options.indent = indent;
    options.padding = options.padding || " ";
    options.cycleDetector = options.cycleDetector || {};

    self._toString(str,options);

    return str.join("\n");
};

BaseNode.prototype._toString = function(str,options)
{

    assert(_.isArray(str));

    options.level = options.level || 1;

    var add = options.add;
    var indent = options.indent;

    var self = this;

    function set_as_processed(nodeId) {
        assert(nodeId instanceof NodeId);
        options.cycleDetector[nodeId.toString()] = nodeId;
    }

    set_as_processed(self.nodeId);

    function is_already_processed(nodeId) {
        return !!options.cycleDetector[nodeId.toString()];
    }


    add("");
    add(options.padding + "          nodeId        : ".yellow + self.nodeId.toString());
    add(options.padding + "          nodeClass     : ".yellow + self.nodeClass.toString());
    add(options.padding + "          browseName    : ".yellow + self.browseName.toString());
    add(options.padding + "          displayName   : ".yellow + self.displayName.map(function (f) {
            return f.locale + " " + f.text;
        }).join(" | "));

    add(options.padding + "          description   : ".yellow + (self.description ? self.description.toString() : ""));


    if (self.dataType) {

        var addressSpace = self.__address_space;
        var d = addressSpace.findNode(self.dataType);
        var n = d ? "(" + d.browseName.toString() + ")" : " (???)";
        add(options.padding + "                dataType: ".yellow + self.dataType +  "  " +n );
    }
    if (self._dataValue) {
        add(options.padding + "                   value: ".yellow + "\n" + indent(self._dataValue.toString(), options.padding + "                        | "));
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


    add(options.padding + "          references    : ".yellow + "  length =" + self._references.length);

    var dispOptions = {
        addressSpace: self.__address_space
    };


    function dump_reference(follow,reference) {
        //xx if (!reference.isForward) {
        //xx     return;
        //xx }
        var o = self.__address_space.findNode(reference.nodeId);
        var name = o ? o.browseName.toString() : "<???>";
        add(options.padding + "               +-> ".yellow + reference.toString(dispOptions) + " " + name.cyan);

        // ignore HasTypeDefinition as it has been already handled
        if (reference.referenceType === "HasTypeDefinition" && reference.nodeId.namespace === 0) {
            return;
        }
        if (o) {
            if (!is_already_processed(o.nodeId)) {
                set_as_processed(o.nodeId);
                if (options.level > 1 && follow) {
                    var rr = o.toString({
                        level: options.level-1,
                        padding: options.padding + "         ",
                        cycleDetector: options.cycleDetector
                    });
                    add(rr);
                }
            }
        }
    }
    // direct reference
    self._references.forEach(dump_reference.bind(null,true));

    add(options.padding + "         back_references: ".yellow + "  length =" + self._back_references.length + " ( references held by other nodes involving this node)".grey);
    // backward reference
    self._back_references.forEach(dump_reference.bind(null,false));

};

/**
 * the dispose method should be called when the node is no longer used, to release
 * back pointer to the address space and clear caches.
 *
 * @method dispose
 *
 */
BaseNode.prototype.dispose = function() {

    var self = this;
    self.emit("dispose");

    self.removeAllListeners();
    self._clear_caches();

    Object.defineProperty(self, "__address_space", {value: null, enumerable: false});
};


exports.BaseNode = BaseNode;
ReferenceType = require("lib/address_space/referenceType").ReferenceType;


/**
 * @property modellingRule
 * @type {String|undefined}
 */
BaseNode.prototype.__defineGetter__("modellingRule",function() {
    var node = this;
    var r = node.findReferencesAsObject("HasModellingRule");
    if (!r || r.length === 0) {
        return "? modellingRule missing ?"; // consider "Mandatory"
    }
    r = r[0];
    return r.browseName.toString();
});

