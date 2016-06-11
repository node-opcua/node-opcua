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

var doDebug = false;

var Reference = require("lib/address_space/reference").Reference;
var sameNodeId = require("lib/datamodel/nodeid").sameNodeId;

var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;


function defaultBrowseFilterFunc(session){

    return  true;
}

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
 * @param [options.browseFilter] {Function}
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

    var self = this;
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

    // user defined filter function for browsing
    this._browseFilter=options.browseFilter || defaultBrowseFilterFunc;
    assert(_.isFunction(this._browseFilter));

    this._cache = {};
    this._referenceIdx = {};
    this._back_referenceIdx = {};
    this._cache_subtypeOfObj = null;
    // normalize reference type
    // this will convert any referenceType expressed with its inverseName into
    // its normal name and fix the isForward flag accordingly.
    // ( e.g "ComponentOf" isForward:true => "HasComponent", isForward:false)
    options.references.forEach(function(reference) {
        self.__addReference(reference);
    });

}
util.inherits(BaseNode, EventEmitter);

var reservedNames = {
    "nodeClass":0,
    "_cache":0,
    "__displayName":0,
    "displayName":0,
    "description":0,
    "__description":0,
    "_referenceIdx":0,
    "__back_referenceIdx":0,
    "typeDefinition":0
};

Object.defineProperty(BaseNode.prototype, "__address_space", {
    writable: true,
    hidden: true,
    enumerable: false
});

BaseNode.Reference = Reference;


/**
 * @property displayName
 * @type LocalizedText[]
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


BaseNode.prototype.findReferencesEx = function (strReference, browseDirection) {
    browseDirection = browseDirection || BrowseDirection.Forward;

    assert(_is_valid_BrowseDirection(browseDirection));
    assert(browseDirection !== BrowseDirection.Both);

    var addressSpace = this.__address_space;

    var referenceType = addressSpace.findReferenceType(strReference);
    if (!referenceType) {
        // note: when loading nodeset2.xml files, reference type may not exit yet
        // throw new Error("expecting valid reference name " + strReference);
        return [];
    }
    assert(referenceType.nodeId instanceof NodeId);

    var keys = referenceType.getSubtypeIndex();

    var isForward = (browseDirection === BrowseDirection.Forward);
    function check_ref(reference) {
        assert(reference instanceof Reference);
        //xx assert(_.isString(reference.referenceType));
        return keys[reference.referenceType] && reference.isForward === isForward
    }

    var references = [];
    function check_and_push(ref) {
        if (check_ref(ref)) {
            references.push(ref);
        }
    }
    _.forEach(this._referenceIdx,check_and_push);
    _.forEach(this._back_referenceIdx,check_and_push);
    return references;
};

BaseNode.prototype.findReferencesExDescription = function (strReference, browseDirection) {

    var refs= this.findReferencesEx(strReference,browseDirection);
    var addressSpace = this.__address_space;
    var r = refs.map(function(ref) {
        return _makeReferenceDescription(addressSpace, ref,0x3F);
    });
    return r;
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
    if (doDebug && !(this.__address_space.findReferenceType(strReference))) {
        throw new Error("expecting valid reference name " + strReference);
    }


    var result = [];
    _.forEach(this._referenceIdx, function (ref) {
        if (ref.isForward === isForward) {
            if(ref.referenceType === strReference) {
                result.push(ref);
            }
        }
    });

    _.forEach(this._back_referenceIdx, function (ref) {
        if (ref.isForward === isForward) {
            if(ref.referenceType === strReference) {
                result.push(ref);
            }
        }
    });

    return result;
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
    var str =  r.toString(options);
    r.dispose();
    return str;
}

/* jshint latedef: false */
function _setup_parent_item(references) {

    references = _.map(references);

    /* jshint validthis: true */
    assert(this instanceof BaseNode);
    assert(_.isArray(references));
    assert(!this._cache.parent && "_setup_parent_item has been already called");

    var addressSpace = this.__address_space;

    if (references.length > 0) {

        var references = this.findReferencesEx("HasChild",BrowseDirection.Inverse);

        if (references.length >= 1) {
            // istanbul ignore next
            if (references.length > 1) {

                if (displayWarning) {

                    var options = { addressSpace: addressSpace};
                    console.warn("  More than one HasChild reference have been found for parent of object");
                    console.warn("    object node id:", this.nodeId.toString(), this.browseName.toString().cyan);
                    console.warn("    browseResults:");
                    console.warn(references.map(function (f) {return toString_ReferenceDescription(f,options);}).join("\n"));
                    console.warn("    first one will be used as parent");
                    //xx assert(browseResults.length === 1);
                    displayWarning = false;
                }
            }
            this._cache.parent = Reference._resolveReferenceNode(addressSpace,references[0]);
        }
    }
}


BaseNode.prototype.findReferencesAsObject = function (strReference, isForward) {

    var nodeIds = this.findReferences(strReference, isForward);
    var addressSpace = this.__address_space;

    function toObject(reference) {
        var obj = _resolveReferenceNode(addressSpace,reference);

        // istanbul ignore next
        if (false && !obj) {
            console.log(" Warning :  object with nodeId ".red + reference.nodeId.toString().cyan + " cannot be found in the address space !".red);
        }
        return obj;
    }

    function remove_null(o) { return !!o; }
    return nodeIds.map(toObject).filter(remove_null);
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
        var nodeId = this.typeDefinition;
        this._cache.typeDefinitionObj = nodeId ? this.__address_space.findNode(nodeId) :null;
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
 * @method getNotifiers
 * @return {BaseNode[]} return a array with the notifiers of this object.
 */
BaseNode.prototype.getNotifiers = function () {
    if (!this._cache._notifiers) {
        this._cache._notifiers = this.findReferencesAsObject("HasNotifier", true);
    }
    return this._cache._notifiers;
};

/**
 * @method getEventSources
 * @return {BaseNode[]} return a array with the event source of this object.
 */
BaseNode.prototype.getEventSources = function () {
    if (!this._cache._eventSources) {
        this._cache._eventSources = this.findReferencesAsObject("HasEventSource", true);
    }
    return this._cache._eventSources;
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
 * @method getMethodByName
 * @param browseName
 * @return {UAMethod|null}
 */
BaseNode.prototype.getMethodByName = function (browseName) {

    var methods = this.getMethods();
    return _.find(methods, function (m) {
        return m.browseName.toString() === browseName.toString();
    });
};

/**
 * returns the nodeId of the Type which is the super type of this
 * @property subtypeOf
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("subtypeOf", function () {
    return this.subtypeOfObj ? this.subtypeOfObj.nodeId:null;
});

BaseNode.prototype.__defineGetter__("subtypeOfObj", function () {
    if (!this._cache_subtypeOfObj) {
        var is_subtype_of_ref = this.findReference("HasSubtype", false);
        if (is_subtype_of_ref) {
            this._cache_subtypeOfObj = Reference._resolveReferenceNode(this.__address_space,is_subtype_of_ref);
        }
    }
    return this._cache_subtypeOfObj;
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
        _setup_parent_item.call(this, this._referenceIdx);
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

    _remove_HierarchicalReference(self,reference);
    var h = reference.hash;
    assert(self._back_referenceIdx[h]);
    self._back_referenceIdx[h].dispose();
    delete self._back_referenceIdx[h];
    reference.dispose();
};

BaseNode.prototype._add_backward_reference = function (reference) {

    var self = this;
    assert(reference instanceof Reference);
    //xx assert(Reference.is_valid_reference(reference));

    var h = reference.hash; assert(_.isString(h));
    // istanbul ignore next
    if (self._referenceIdx[h]) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <Reference>
        //  in this case there is nothing to do
        return;
    }
    // istanbul ignore next
    if (self._back_referenceIdx[h]) {
        var opts = { addressSpace: self.__address_space};
        console.warn(" Warning !",self.browseName.toString());
        console.warn("    ",reference.toString(opts));
        console.warn(" already found in ===>");
        console.warn(_.map(self._back_referenceIdx.map(function(c){ return c.toString(opts);})).join("\n"));
        console.warn("===>");
        throw new Error("reference exists already in _back_references");
    }
    self._back_referenceIdx[h] = reference;
    _handle_HierarchicalReference(self,reference);
    self._clear_caches();

};

var displayWarningReferencePointingToItsef = true;

function _propagate_ref(self, addressSpace, reference) {

    // filter out non  Hierarchical References
    var referenceType = _resolveReferenceType(addressSpace,reference);

    // istanbul ignore next
    if (!referenceType) {
        console.error(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
    }

    //xx if (!referenceType.isSupertypeOf(hierarchicalReferencesId)) { return; }
    var related_node = _resolveReferenceNode(addressSpace,reference);
    if (related_node) {

        // verify that reference doesn't point to object itself (see mantis 3099)
        if (sameNodeId(reference.nodeId,self.nodeId)) {

            // istanbul ignore next
            if (displayWarningReferencePointingToItsef) {
                // this could happen with method
                console.warn("  Warning: a Reference is pointing to itself ", self.nodeId.toString(), self.browseName.toString());
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

    } // else addressSpace may be incomplete and under construction (while loading a nodeset.xml file for instance)
}
/**
 * this methods propagates the forward references to the pointed node
 * by inserting backward references to the counter part node
 *
 * @method propagate_back_references
 */
BaseNode.prototype.propagate_back_references = function () {

    var self = this;
    if (self.__address_space.suspendBackReference) {

        // this indicates that the base node is constructed from an xml definition
        // propagate_back_references will be called later once the file has been completely processed.
        return; 
    }
    var addressSpace = self.__address_space;
    _.forEach(self._referenceIdx,function (reference) {
        _propagate_ref(self, addressSpace, reference);
    });
};


var cetools = require("./address_space_change_event_tools");


function _handle_HierarchicalReference(node,reference) {

    if (node._cache_childByNameMap) {
        var addressSpace = node.__address_space;
        var referenceType = Reference._resolveReferenceType(addressSpace,reference);

        if (referenceType) {

            var HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");

            //xx console.log ("HierarchicalReferencesType",HierarchicalReferencesType.toString());
            if (referenceType.isSupertypeOf(HierarchicalReferencesType)) {
                assert(reference.isForward);
                var targetNode = Reference._resolveReferenceNode(addressSpace,reference);
                //Xx console.log(" adding object to map");
                node._cache_childByNameMap[targetNode.browseName.toString()] = targetNode;
            }
        }

    }
}
function _remove_HierarchicalReference(node,reference) {

    if (node._cache_childByNameMap) {
        var addressSpace = node.__address_space;
        var referenceType = Reference._resolveReferenceType(addressSpace,reference);

        if (referenceType) {
            var HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");
            if (referenceType.isSupertypeOf(HierarchicalReferencesType)) {
                assert(reference.isForward);
                var targetNode = Reference._resolveReferenceNode(addressSpace,reference);
                //Xx console.log(" adding object to map");
                delete node._cache_childByNameMap[targetNode.browseName.toString()];
            }
        }
    }
}
BaseNode.prototype.__addReference = function (reference) {

    var self = this;

    assert(reference.hasOwnProperty("referenceType"));
    //xx isForward is optional : assert(reference.hasOwnProperty("isForward"));
    assert(reference.hasOwnProperty("nodeId"));

    var addressSpace = self.__address_space;
    reference = addressSpace.normalizeReferenceTypes([reference])[0];

    var h = reference.hash;
    assert(!self._back_referenceIdx[h],"reference exists already in _back_references");
    assert(!self._referenceIdx[h],"reference exists already in _references");

///    self._references.push(reference);
    self._referenceIdx[h] = reference;
    _handle_HierarchicalReference(self,reference);
    return reference;
};

/**
 * @method addReference
 * @param reference
 * @param reference.referenceType {String}
 * @param [reference.isForward = true] {Boolean}
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

    reference = self.__addReference(reference);

    var addressSpace = this.__address_space;
    if (!_resolveReferenceType(addressSpace,reference)) {
       throw new Error("BaseNode#addReference : invalid reference " + h + " " +reference.toString());
    }
    self._clear_caches();
    
    _propagate_ref(self, addressSpace, reference);
    self.install_extra_properties();
    cetools._handle_add_reference_change_event(self,reference.nodeId);

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
    _.forEach(self._referenceIdx,function (reference) {

        // filter out non  Hierarchical References
        var referenceType = _resolveReferenceType(addressSpace,reference);

        // istanbul ignore next
        if (!referenceType) {
            console.error(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
        }

        var related_node = _resolveReferenceNode(addressSpace,reference);
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
 *
 * @param relativePathElement                           {RelativePathElement}
 * @param relativePathElement.targetName                {QualifiedName}
 * @param relativePathElement.targetName.name           {String}
 * @param relativePathElement.targetName.namespaceIndex {UInt32}
 * @param relativePathElement.referenceTypeId           {NodeId}
 * @param relativePathElement.isInverse                 {Boolean}
 * @param relativePathElement.includeSubtypes           {Boolean}
 *
 * @return {NodeId[]}
 */
BaseNode.prototype.browseNodeByTargetName = function (relativePathElement,isLast) {

    var self = this;

    relativePathElement.targetName = relativePathElement.targetName || new QualifiedName();
    // part 4.0 v1.03 $7.26 RelativePath
    // The BrowseName of the target node.
    // The final element may have an empty targetName. In this situation all targets of the references identified by
    // the referenceTypeId are the targets of the RelativePath.
    // The targetName shall be specified for all other elements.
    // The current path cannot be followed any further if no targets with the specified BrowseName exist.
    assert(relativePathElement.targetName instanceof QualifiedName);
    assert(relativePathElement.targetName.namespaceIndex >= 0);
    assert(relativePathElement.targetName.name.length > 0);

    // The type of reference to follow from the current node.
    // The current path cannot be followed any further if the referenceTypeId is not available on the Node instance.
    // If not specified then all References are included and the parameter includeSubtypes is ignored.
    assert(relativePathElement.hasOwnProperty("referenceTypeId"));

    // Indicates whether the inverse Reference should be followed. The inverse reference is followed if this value is TRUE.
    assert(relativePathElement.hasOwnProperty("isInverse"));

    //Indicates whether subtypes of the ReferenceType should be followed. Subtypes are included if this value is TRUE.
    assert(relativePathElement.hasOwnProperty("includeSubtypes"));


    var references = [].concat(_.map(self._referenceIdx),_.map(self._back_referenceIdx));

    function _check_reference(reference) {

        if (relativePathElement.referenceTypeId.isEmpty()) {
            return true;
        }
        assert(relativePathElement.referenceTypeId instanceof NodeId);
        if ((relativePathElement.isInverse && reference.isForward) ||
            (!relativePathElement.isInverse && !reference.isForward )) {
            return false;
        }
        assert(reference.hasOwnProperty("isForward"));
        var referenceType = _resolveReferenceType(self.__address_space,reference);
        var referenceTypeId = referenceType.nodeId;

        if (sameNodeId(relativePathElement.referenceTypeId,referenceTypeId)) {
            return true;
        }
        if (relativePathElement.includeSubtypes) {
            var baseType = self.__address_space.findNode(relativePathElement.referenceTypeId);
            if(baseType && referenceType.isSupertypeOf(baseType)) {
                return true;
            }
        }
        return false;
    }

    var nodeIdsMap = {};
    var nodeIds = [];
    references.forEach(function (reference) {

        if (!_check_reference(reference)) {
            return;
        }

        var obj = _resolveReferenceNode(self.__address_space,reference);

        // istanbul ignore next
        if (!obj) {
            throw new Error(" cannot find node with id ", reference.nodeId.toString());
        }

        if (_.isEqual(obj.browseName, relativePathElement.targetName)) { // compare QualifiedName
            var key = obj.nodeId.toString();
            if (!nodeIdsMap.hasOwnProperty(key)) {
                nodeIds.push(obj.nodeId);
                nodeIdsMap[key] = obj;
            }
        }
    });
    if (self.subtypeOf) {
        // browsing also InstanceDeclarations included in base type
        var baseType = self.__address_space.findNode(self.subtypeOf);
        var n = baseType.browseNodeByTargetName(relativePathElement,isLast);
        nodeIds = [].concat(nodeIds, n);
    }
    return nodeIds;
};

var check_flag = require("lib/misc/utils").check_flag;
var rm = ResultMask;


var _makeReferenceDescription = function (addressSpace, reference, resultMask) {

    var isForward = reference.isForward;

    var referenceTypeId =  _resolveReferenceType(addressSpace,reference).nodeId;
    assert(referenceTypeId instanceof NodeId);

    var obj = _resolveReferenceNode(addressSpace,reference);

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

    _.forEach(references,function (reference) {

        var referenceType = Reference._resolveReferenceType(addressSpace,reference);
        if (!referenceType) {
            // unknown type ... this may happen when the address space is not fully build
            return;
        }
        var dir = reference.isForward ? "(=>)" : "(<-)";
        var objectName = nodeIdInfo(addressSpace, reference.nodeId);

        console.log(" referenceType : ", dir, referenceType ? referenceType.browseName.toString() : reference.referenceType.toString(), " ", objectName);
    });
}

exports.dumpBrowseDescription = dumpBrowseDescription;
exports.dumpReferences = dumpReferences;

var _resolveReferenceNode = Reference._resolveReferenceNode;
var _resolveReferenceType = Reference._resolveReferenceType;


function _filter_by_referenceType(self, browseDescription, references, referenceTypeId) {

    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {

        assert(referenceTypeId instanceof NodeId);
        var referenceType = self.__address_space.findNode(referenceTypeId);

        dumpIf(!referenceType, referenceTypeId);
        assert(referenceType instanceof ReferenceType);

        references = references.filter(function (reference) {

            // xxx if (reference.referenceType === "HasSubtype"){ return false;  }
            /// var ref = self.__address_space.findReferenceType(reference.referenceType);
            var ref = _resolveReferenceType(self.__address_space,reference);

            if (!ref) {
                return false;
            } // unknown type ... this may happen when the address space is not fully build
            assert(ref instanceof ReferenceType);

            var is_of_type = ref.nodeId.toString() === referenceType.nodeId.toString();
            if (is_of_type) { return true; }
            if (browseDescription.includeSubtypes) {
                return ref.isSupertypeOf(referenceType) ;
            } else {
                return false;
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

        var obj = _resolveReferenceNode(addressSpace,reference);

        if (!obj) {
            return false;
        }

        var nodeClassName = obj.nodeClass.key;

        var value = browse_service.makeNodeClassMask(nodeClassName);
        return (value & nodeClassMask ) === value;

    });
}

function _filter_by_userFilter(self, references, session) {

    var addressSpace = self.__address_space;
    return references.filter(function (reference) {

        var obj = _resolveReferenceNode(addressSpace,reference);

        if (!obj) {
            return false;
        }

        return (obj._browseFilter(session));
    });
}

/**
 * browse the node to extract information requested in browseDescription
 * @method browseNode
 * @param browseDescription                 {BrowseDescription}
 * @param browseDescription.referenceTypeId {NodeId}
 * @param browseDescription.browseDirection {BrowseDirection}
 * @param browseDescription.nodeClassMask   {NodeClassMask}
 * @param browseDescription.resultMask      {UInt32}
 * @param session                           {ServerSession}
 * @return {ReferenceDescription[]}
 */
BaseNode.prototype.browseNode = function (browseDescription, session) {

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
    var references = [].concat(_.map(self._referenceIdx),_.map(self._back_referenceIdx));

    /* istanbul ignore next */
    if (do_debug) {
        console.log("all references :", self.nodeId.toString(), self.browseName.toString());
        dumpReferences(addressSpace, _.map(self._referenceIdx));
    }

    // filter out references not matching referenceType
    references = _filter_by_referenceType(self, browseDescription, references, referenceTypeId);

    references = _filter_by_direction(references, browseDirection);

    references = _filter_by_nodeclass(self, references, browseDescription.nodeClassMask);

    references = _filter_by_userFilter(self, references, session);

    var referenceDescriptions = _constructReferenceDescription(addressSpace, references, browseDescription.resultMask);

    /* istanbul ignore next */
    if (do_debug) {
        dumpReferenceDescriptions(self.__address_space, referenceDescriptions);
    }

    return referenceDescriptions;
};

/*
 * install hierachical references as javascript properties
 * Components/Properties/Organizes
 */
function install_components_as_object_properties(parentObj) {

    if (!parentObj) {
        return;
    }

    var addressSpace = parentObj.__address_space;
    var hierarchicalRefs = parentObj.findHierarchicalReferences();

    var children = hierarchicalRefs.map(function(r){
        return _resolveReferenceNode(addressSpace,r);
    });


    children.forEach(function (child) {

        if (!child) {
            return;
        }
        // assumption: we ignore namespace here .
        var name = lowerFirstLetter(child.browseName.name.toString());


        if (reservedNames.hasOwnProperty(name)) {
            console.log(("Ignoring reversed keyword                                               "+ name).bgWhite.red);
            return;
        }
        /* istanbul ignore next */
        if (parentObj.hasOwnProperty(name)) {
            return;
        }

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

BaseNode.prototype.install_extra_properties = function () {

    var self = this;

    install_components_as_object_properties(self);

    var addressSpace = self.__address_space;

    function install_extra_properties_on_parent(ref) {
        var node = Reference._resolveReferenceNode(addressSpace,ref);
        install_components_as_object_properties(node);
    }
    // make sure parent have extra properties updated
    var components = self.findReferences("HasComponent", false);
    var subfolders = self.findReferences("Organizes", false);
    var properties = self.findReferences("HasProperty", false);
    components.forEach(install_extra_properties_on_parent);
    subfolders.forEach(install_extra_properties_on_parent);
    properties.forEach(install_extra_properties_on_parent);


};


function _clone_collection(newParent,collection,referenceType,optionalFilter, extraInfo) {

    assert(!optionalFilter || _.isFunction(optionalFilter));

    collection.forEach(function (node) {
        // ensure node is of the correct type,
        // it may happen that the xmlnodeset2 file was malformed

        // istanbul ignore next
        if (!_.isFunction(node.clone)) {
            console.log("Warning : cannot clone node ".red + node.browseName.toString() + " of class " + node.nodeClass.toString());
            return;
        }

        if (optionalFilter) {
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
 * @param extraInfo
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

    if (self.modellingRule) {
        var modellingRuleNode = self.findReferencesAsObject("HasModellingRule")[0];
        assert(modellingRuleNode);
        {
            options.references.push({referenceType: "HasModellingRule", isForward: true, nodeId: modellingRuleNode.nodeId});
        }
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
    if (self.hasOwnProperty("valueRank")) {
        add(options.padding + "               valueRank: ".yellow + " " + self.valueRank.toString());
    }
    if (self.minimumSamplingInterval !== undefined) {
        add(options.padding + " minimumSamplingInterval: ".yellow + " " + self.minimumSamplingInterval.toString() + " ms");
    }


    add(options.padding + "          references    : ".yellow + "  length =" + Object.keys(self._referenceIdx).length);

    var dispOptions = {
        addressSpace: self.__address_space
    };


    function dump_reference(follow,reference) {
        //xx if (!reference.isForward) {
        //xx     return;
        //xx }
        var o = _resolveReferenceNode(self.__address_space,reference);
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
    _.forEach(self._referenceIdx,dump_reference.bind(null,true));

    var  br = _.map(self._back_referenceIdx);
    add(options.padding + "         back_references: ".yellow + "  length =" + br.length + " ( references held by other nodes involving this node)".grey);
    // backward reference
    br.forEach(dump_reference.bind(null,false));

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
    self._cache_childByNameMap = null;
    self._cache_subtypeOfObj = null;

    _.forEach(self._back_referenceIdx,function(ref){ ref.dispose(); });
    _.forEach(self._referenceIdx,function(ref){ ref.dispose(); });

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
        return null; ///"? modellingRule missing ?"; // consider "Mandatory"
    }
    r = r[0];
    return r.browseName.toString();
});

/**
 * @property isTrueSubStateOf
 * @type {BaseNode|null}
 */
BaseNode.prototype.__defineGetter__("isTrueSubStateOf",function() {
    var node = this;
    var r = node.findReferencesAsObject("HasTrueSubState",false);
    if (!r || r.length === 0) {
        return null;
    }
    assert(r.length === 1);
    r = r[0];
    return r;
});
/**
 * @property isFalseSubStateOf
 * @type {BaseNode|null}
 */
BaseNode.prototype.__defineGetter__("isFalseSubStateOf",function() {
    var node = this;
    var r = node.findReferencesAsObject("HasFalseSubState",false);
    if (!r || r.length === 0) {
        return null;
    }
    assert(r.length === 1);
    r = r[0];
    return r;
});


/**
 * @method getFalseSubStates
 * @return {BaseNode[]} return an array with the SubStates of this object.
 */
BaseNode.prototype.getFalseSubStates = function () {
    return this.findReferencesAsObject("HasFalseSubState");
};

/**
 * @method getTrueSubStates
 * @return {BaseNode[]} return an array with the SubStates of this object.
 */
BaseNode.prototype.getTrueSubStates = function () {
    return  this.findReferencesAsObject("HasTrueSubState");
};



BaseNode.prototype.findHierarchicalReferences = function() {

    var node  = this;
    if (!node._cache._HasChildReferences) {
        //xx console.log("node ",node.nodeId.toString());
        //xx node._cache._HasChildReferences =  node.findReferencesEx("HierarchicalReferences",BrowseDirection.Forward);
        var r1 = node.findReferencesEx("HasChild",BrowseDirection.Forward);
        var r2 = node.findReferencesEx("Organizes",BrowseDirection.Forward);
        node._cache._HasChildReferences = r1.concat(r2);
    }
    return node._cache._HasChildReferences;
};

BaseNode.prototype.getChildByName = function(browseName) {

    var node = this;

    browseName = browseName.toString();

    var addressSpace = node.__address_space;

    if (!node._cache_childByNameMap) {

        node._cache_childByNameMap = {};
        var childrenRef = node.findHierarchicalReferences();

        _.forEach(childrenRef,function(r){
            var child = _resolveReferenceNode(addressSpace,r);
            node._cache_childByNameMap[child.browseName.toString()] = child;
        });
    }
    var ret = node._cache_childByNameMap[browseName] || null;
    return ret;
};

