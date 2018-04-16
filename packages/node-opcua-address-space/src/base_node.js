"use strict";

/*jslint bitwise: true */
/**
 * @module opcua.address_space
 */


const util = require("util");
const utils = require("node-opcua-utils");

const EventEmitter = require("events").EventEmitter;

const NodeId = require("node-opcua-nodeid").NodeId;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const sameNodeId = require("node-opcua-nodeid").sameNodeId;

const coerceQualifyName = require("node-opcua-data-model").coerceQualifyName;
const QualifiedName = require("node-opcua-data-model").QualifiedName;
const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
const AttributeNameById = require("node-opcua-data-model").AttributeNameById;
const ResultMask = require("node-opcua-data-model").ResultMask;
const NodeClass = require("node-opcua-data-model").NodeClass;
const makeNodeClassMask = require("node-opcua-data-model").makeNodeClassMask;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const ReferenceDescription = require("node-opcua-service-browse").ReferenceDescription;

const DataValue =  require("node-opcua-data-value").DataValue;

const DataType = require("node-opcua-variant").DataType;

const StatusCodes = require("node-opcua-status-code").StatusCodes;


exports.BrowseDirection = BrowseDirection;

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const dumpIf = require("node-opcua-debug").dumpIf;
let ReferenceType = null;// will be defined after baseNode is defined

const lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;
const capitalizeFirstLetter = require("node-opcua-utils").capitalizeFirstLetter;

const doDebug = false;

const SessionContext = require("./session_context").SessionContext;
const Reference = require("./reference").Reference;




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

    const self = this;
    const _private = BaseNode_initPrivate(self);

    assert(this.nodeClass);
    assert(options.addressSpace); // expecting an address space
    options.references = options.references || [];

    _private.__address_space = options.addressSpace;

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


    //Xx Object.defineProperty(this, "_cache",             {configurable: true,value:{}, hidden:true,enumerable: false});
    //xx Object.defineProperty(this, "_referenceIdx",      {configurable: true,value:{}, hidden:true,enumerable: false});
    //xx Object.defineProperty(this, "_back_referenceIdx", {configurable: true,value:{}, hidden:true,enumerable: false});


    // user defined filter function for browsing
    const _browseFilter = options.browseFilter || defaultBrowseFilterFunc;
    assert(_.isFunction(_browseFilter));
    Object.defineProperty(this, "_browseFilter",      {configurable: true,value:_browseFilter, hidden:true,enumerable: false});

     // normalize reference type
    // this will convert any referenceType expressed with its inverseName into
    // its normal name and fix the isForward flag accordingly.
    // ( e.g "ComponentOf" isForward:true => "HasComponent", isForward:false)
    for (const reference of options.references) {
        self.__addReference(reference);
    }

}
util.inherits(BaseNode, EventEmitter);


const reservedNames = {
    "nodeClass":0,
    //Xx "_cache":0,
    //Xx  "_referenceIdx":0,
    //Xx  "__back_referenceIdx":0,
    "__displayName":0,
    "displayName":0,
    "description":0,
    "__description":0,
    "typeDefinition":0
};

BaseNode.Reference = Reference;


/**
 * @property displayName
 * @type LocalizedText[]
 */
Object.defineProperty(BaseNode.prototype, "__displayName", {writable: true, hidden: true, enumerable: false});
BaseNode.prototype._setDisplayName = function (displayName) {
    displayName = _.isArray(displayName) ? displayName : [displayName];
    const _displayName = displayName.map(coerceLocalizedText);
    Object.defineProperty(this, "__displayName",  {configurable: true,value:_displayName, hidden:true,enumerable: false});
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
    },
    hidden: false,
    enumerable: true
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
    const __description = coerceLocalizedText(description);
    Object.defineProperty(this, "__description",  {configurable: true,value:__description, hidden:true,enumerable: false});
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
    },
    hidden: false,
    enumerable: true
});

BaseNode.makeAttributeEventName = function (attributeId) {

    const attributeName = AttributeNameById[attributeId];
    return attributeName + "_changed";
};


BaseNode.prototype._notifyAttributeChange = function (attributeId) {
    const self = this;
    const event_name = BaseNode.makeAttributeEventName(attributeId);
    self.emit(event_name, self.readAttribute(SessionContext.defaultContext, attributeId));
};


function _is_valid_BrowseDirection(browseDirection) {
    return  browseDirection === BrowseDirection.Forward ||
            browseDirection === BrowseDirection.Inverse ||
            browseDirection === BrowseDirection.Both
        ;
}

const g_weakMap = new WeakMap();

function BaseNode_initPrivate(self) {
    assert(self instanceof BaseNode);
    const _private = {
        _referenceIdx : {},
        _back_referenceIdx: {},
        __address_space: null,
        _cache: {}
    };
    g_weakMap.set(self,_private);
    return _private;
}
function BaseNode_getPrivate(self) {
    return g_weakMap.get(self);
}
BaseNode._getCache = function(self) {
    const _private = BaseNode_getPrivate(self);
    return _private._cache;
}


BaseNode.prototype.findReferencesEx = function (strReference, browseDirection) {

    browseDirection = browseDirection || BrowseDirection.Forward;
    assert(_is_valid_BrowseDirection(browseDirection));
    assert(browseDirection !== BrowseDirection.Both);

    if (typeof strReference !== "string") {
        assert(strReference instanceof ReferenceType);
        strReference = strReference.browseName.toString();
    }

    const self = this;
    const _private = BaseNode_getPrivate(self);


    const hash = "_refEx_"+strReference+browseDirection.toString();
    if (_private._cache[hash]) {
        return _private._cache[hash];
    }

    const addressSpace = this.addressSpace;

    const referenceType = addressSpace.findReferenceType(strReference);
    if (!referenceType) {
        // note: when loading nodeset2.xml files, reference type may not exit yet
        // throw new Error("expecting valid reference name " + strReference);
        return [];
    }
    assert(referenceType.nodeId instanceof NodeId);

    const keys = referenceType.getSubtypeIndex();

    const isForward = (browseDirection === BrowseDirection.Forward);
    const references = [];


    /*
    function check_ref(reference) {
        assert(reference instanceof Reference);
        //xx assert(_.isString(reference.referenceType));
        return keys[reference.referenceType] && reference.isForward === isForward
    }

    function check_and_push(ref) {
        if (check_ref(ref)) {
            references.push(ref);
        }
    }
    _.forEach(_private._referenceIdx,check_and_push);
    _.forEach(_private._back_referenceIdx,check_and_push);
    */
    // faster version of the above without func call
    function process(referenceIdx) {
        let i, length, ref;
        const _hashes = _.keys(referenceIdx);
        for (i=0,length =_hashes.length;i<length;i++ ) {
            ref = referenceIdx[_hashes[i]];
            if (keys[ref.referenceType] && ref.isForward === isForward){
                references.push(ref);
            }
        }
    }
    process(_private._referenceIdx);
    process(_private._back_referenceIdx);
    _private._cache[hash] = references;
    return references;
};

BaseNode.prototype.findReferencesExDescription = function (strReference, browseDirection) {

    const refs= this.findReferencesEx(strReference,browseDirection);
    const addressSpace = this.addressSpace;
    const r = refs.map(function(ref) {
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

    const self  = this;
    const _private = BaseNode_getPrivate(self);

    isForward = utils.isNullOrUndefined(isForward) ? true : !!isForward;

    assert(_.isString(strReference));
    assert(_.isBoolean(isForward));

    const hash = "_ref_"+strReference+isForward.toString();
    if (_private._cache[hash]) {
        return _private._cache[hash];
    }

    // istanbul ignore next
    if (doDebug && !(this.addressSpace.findReferenceType(strReference))) {
        throw new Error("expecting valid reference name " + strReference);
    }


    const result = [];
    _.forEach(_private._referenceIdx, function (ref) {
        if (ref.isForward === isForward) {
            if(ref.referenceType === strReference) {
                result.push(ref);
            }
        }
    });

    _.forEach(_private._back_referenceIdx, function (ref) {
        if (ref.isForward === isForward) {
            if(ref.referenceType === strReference) {
                result.push(ref);
            }
        }
    });

    _private._cache[hash] = result;
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

    let refs = this.findReferences(strReference, isForward);

    if (optionalSymbolicName) {
        // search reference that matches symbolic name
        refs = refs.filter(function (ref) {
            return ref.symbolicName === optionalSymbolicName;
        });
    }
    assert(refs.length === 1 || refs.length === 0, "findReference: expecting only one or zero element here");
    return refs.length === 0 ? null : refs[0];
};


let displayWarning = true;



function toString_ReferenceDescription(ref,options) {

    const addressSpace = options.addressSpace;
    //xx assert(ref instanceof ReferenceDescription);
    const refNode = addressSpace.findNode(ref.referenceTypeId);
    if (!refNode) {
        return "Unknown Ref : "+ ref;
    }
    const r = new Reference({
        referenceType: refNode.browseName.toString(),
        nodeId:        ref.nodeId,
        isForward:     ref.isForward
    });
    const str =  r.toString(options);
    r.dispose();
    return str;
}

/* jshint latedef: false */
function _setup_parent_item(references) {

    references = _.map(references);

    /* jshint validthis: true */
    assert(this instanceof BaseNode);
    assert(_.isArray(references));
    const _private = BaseNode_getPrivate(this);

    assert(!_private.parent && "_setup_parent_item has been already called");

    const addressSpace = this.addressSpace;

    if (references.length > 0) {

        references = this.findReferencesEx("HasChild",BrowseDirection.Inverse);

        if (references.length >= 1) {
            // istanbul ignore next
            if (references.length > 1) {

                if (displayWarning) {

                    const options = { addressSpace: addressSpace};
                    console.warn("  More than one HasChild reference have been found for parent of object");
                    console.warn("    object node id:", this.nodeId.toString(), this.browseName.toString().cyan);
                    console.warn("    browseResults:");
                    console.warn(references.map(function (f) {return toString_ReferenceDescription(f,options);}).join("\n"));
                    console.warn("    first one will be used as parent");
                    //xx assert(browseResults.length === 1);
                    displayWarning = false;
                }
            }
            _private.parent = Reference._resolveReferenceNode(addressSpace,references[0]);
        }
    }
}


function _asObject(nodeIds,addressSpace) {
    function toObject(reference) {
        const obj = _resolveReferenceNode(addressSpace,reference);

        // istanbul ignore next
        if (false && !obj) {
            console.log(" Warning :  object with nodeId ".red + reference.nodeId.toString().cyan + " cannot be found in the address space !".red);
        }
        return obj;
    }

    function remove_null(o) { return !!o; }
    return nodeIds.map(toObject).filter(remove_null);
}

BaseNode.prototype.findReferencesExAsObject = function (strReference, browseDirection) {

    const nodeIds = this.findReferencesEx(strReference, browseDirection);
    const addressSpace = this.addressSpace;
    return _asObject(nodeIds,addressSpace);

};

BaseNode.prototype.findReferencesAsObject = function (strReference, isForward) {

    const nodeIds = this.findReferences(strReference, isForward);
    const addressSpace = this.addressSpace;
    return _asObject(nodeIds,addressSpace);
};


/**
 * returns the nodeId of this node's Type Definition
 * @property typeDefinition
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("typeDefinition", function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (! _private._cache.typeDefinition) {
        const has_type_definition_ref = this.findReference("HasTypeDefinition", true);
        _private._cache.typeDefinition = has_type_definition_ref ? has_type_definition_ref.nodeId : null;
    }
    return _private._cache.typeDefinition;
});


/**
 * returns the nodeId of this node's Type Definition
 * @property typeDefinitionObj
 * @type {BaseNode}
 */
BaseNode.prototype.__defineGetter__("typeDefinitionObj", function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (undefined === _private._cache.typeDefinitionObj) {
        const nodeId = this.typeDefinition;
        _private._cache.typeDefinitionObj = nodeId ? this.addressSpace.findNode(nodeId) :null;
    }
    return _private._cache.typeDefinitionObj;
});


/**
 * @method getAggregates
 * @return {BaseNode[]} return an array with the Aggregates of this object.
 */
BaseNode.prototype.getAggregates = function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._aggregates) {
        _private._cache._aggregates = this.findReferencesExAsObject("Aggregates",BrowseDirection.Forward);
    }
    return _private._cache._aggregates;
};

/**
 * @method getComponents
 * @return {BaseNode[]} return an array with the components of this object.
 */
BaseNode.prototype.getComponents = function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._components) {
        _private._cache._components = this.findReferencesExAsObject("HasComponent",BrowseDirection.Forward);
        //xx_private._cache._components = this.findReferencesAsObject("HasComponent", true);
    }
    return _private._cache._components;
};

/**
 * @method getProperties
 * @return {BaseNode[]} return a array with the properties of this object.
 */
BaseNode.prototype.getProperties = function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._properties) {
        _private._cache._properties = this.findReferencesExAsObject("HasProperty", BrowseDirection.Forward);
    }
    return _private._cache._properties;
};

/**
 * @method getNotifiers
 * @return {BaseNode[]} return a array with the notifiers of this object.
 */
BaseNode.prototype.getNotifiers = function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._notifiers) {
        _private._cache._notifiers = this.findReferencesAsObject("HasNotifier", true);
    }
    return _private._cache._notifiers;
};

/**
 * @method getEventSources
 * @return {BaseNode[]} return a array with the event source of this object.
 */
BaseNode.prototype.getEventSources = function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._eventSources) {
        _private._cache._eventSources = this.findReferencesAsObject("HasEventSource", true);
    }
    return _private._cache._eventSources;
};

/**
 * @method getEventSourceOfs
 * @return {BaseNode[]} return a array of the objects for which this node is an EventSource
 */
BaseNode.prototype.getEventSourceOfs = function () {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._eventSources) {
        _private._cache._eventSources = this.findReferencesAsObject("HasEventSource", false);
    }
    return _private._cache._eventSources;
};
/**
 * retrieve a component by name
 * @method getComponentByName
 * @param browseName
 * @return {BaseNode|null}
 */
BaseNode.prototype.getComponentByName = function (browseName) {
    assert(typeof browseName === "string");
    const components = this.getComponents();
    const select = components.filter(function (c) {
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
    const properties = this.getProperties();
    const select = properties.filter(function (c) {
        return c.browseName.toString() === browseName;
    });
    assert(select.length <=1, "BaseNode#getPropertyByName found duplicated reference");
    return select.length === 1 ? select[0] : null;
};


BaseNode.prototype.getFolderElementByName = function(browseName) {
    assert(typeof browseName === "string");
    const elements = this.getFolderElements();
    const select = elements.filter(function (c) {
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
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._methods) {
        const components = this.getComponents();
        const UAMethod = require("./ua_method").UAMethod;
        _private._cache._methods = components.filter(function (obj) {
            return obj instanceof UAMethod;
        });
    }
    return _private._cache._methods;
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

    const methods = this.getMethods();
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

    const methods = this.getMethods();
    return _.find(methods, function (m) {
        return m.browseName.toString() === browseName.toString();
    });
};

/**
 * returns the nodeId of the Type which is the super type of this
 * @property subtypeOf
 * @type {NodeId}
 */
BaseNode.prototype.__defineGetter__("subtypeOf", function subtypeOf() {
    return this.subtypeOfObj ? this.subtypeOfObj.nodeId:null;
});

BaseNode.prototype.__defineGetter__("subtypeOfObj", function subtypeOfObj() {
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache._subtypeOfObj) {
        const is_subtype_of_ref = this.findReference("HasSubtype", false);
        if (is_subtype_of_ref) {
            _private._cache._subtypeOfObj = Reference._resolveReferenceNode(this.addressSpace,is_subtype_of_ref);
        }
    }
    return _private._cache._subtypeOfObj;
});



BaseNode.prototype.__findReferenceWithBrowseName = function(referenceType,browseName) {
    const refs = this.findReferencesAsObject(referenceType);

    function hasBrowseName(node) {
        return node.browseName.toString() === browseName;
    }
    const ref = refs.filter(hasBrowseName)[0];
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
    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (!_private._cache.namespaceUri) {
        _private._cache.namespaceUri = this.addressSpace.getNamespaceUri(this.namespaceIndex);
    }
    return _private._cache.namespaceUri;
});

/**
 * the parent node
 * @property parent
 * @type {BaseNode}
 */
BaseNode.prototype.__defineGetter__("parent", function () {

    const self = this;
    const _private = BaseNode_getPrivate(self);
    if (_private.parent === undefined) {
        _setup_parent_item.call(this, _private._referenceIdx);
    }
    return _private.parent;
});

/**
 * @method resolveNodeId
 * @param nodeId
 * @return {NodeId}
 */
BaseNode.prototype.resolveNodeId = function (nodeId) {
    return this.addressSpace.resolveNodeId(nodeId);
};

BaseNode.prototype._remove_backward_reference = function (reference) {
    const self = this;
    const _private = BaseNode_getPrivate(self);

    assert(reference instanceof Reference);

    _remove_HierarchicalReference(self,reference);
    const h = reference.hash;

    if (_private._back_referenceIdx[h]) {
        // note : h may not exist in _back_referenceIdx since we are not indexing
        //        _back_referenceIdx to UAObjectType and UAVariableType for performance reasons
        _private._back_referenceIdx[h].dispose();
        delete _private._back_referenceIdx[h];
    }
    reference.dispose();
};

BaseNode.prototype._add_backward_reference = function (reference) {

    const self = this;
    const _private = BaseNode_getPrivate(self);

    assert(reference instanceof Reference);
    //xx assert(Reference.is_valid_reference(reference));

    const h = reference.hash; assert(_.isString(h));
    // istanbul ignore next
    if (_private._referenceIdx[h]) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <Reference>
        //  in this case there is nothing to do
        return;
    }
    // istanbul ignore next
    if (_private._back_referenceIdx[h]) {
        const opts = { addressSpace: self.addressSpace};
        console.warn(" Warning !",self.browseName.toString());
        console.warn("    ",reference.toString(opts));
        console.warn(" already found in ===>");
        console.warn(_.map(_private._back_referenceIdx.map(function(c){ return c.toString(opts);})).join("\n"));
        console.warn("===>");
        throw new Error("reference exists already in _back_references");
    }
    _private._back_referenceIdx[h] = reference;
    _handle_HierarchicalReference(self,reference);
    self._clear_caches();

};

let displayWarningReferencePointingToItsef = true;

function _is_massively_used_reference(referenceType) {
    const name = referenceType.browseName.toString();
    return name === "HasTypeDefinition" || name === "HasModellingRule";

}
function _propagate_ref(self, addressSpace, reference) {

    // filter out non  Hierarchical References
    const referenceType = _resolveReferenceType(addressSpace,reference);

    // istanbul ignore next
    if (!referenceType) {
        console.error(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
    }

    // ------------------------------- Filter out back reference when reference type
    //                                 is HasTypeDefinition, HasModellingRule, etc ...
    //
    // var referenceNode = Reference._resolveReferenceNode(addressSpace,reference);
    // ignore propagation on back reference to UAVariableType or UAObject Type reference
    // because there are too many !
    if (referenceType && _is_massively_used_reference(referenceType)) {
        //xx &&(referenceNode.constructor.name === "UAVariableType" || referenceNode.constructor.name  === "UAObjectType")
        // console.log(referenceType.browseName.toString() ,referenceNode.browseName.toString(), "on ",self.browseName.toString());
        return;
    }
    // ------------------------------- EXPERIMENT


    //xx if (!referenceType.isSupertypeOf(hierarchicalReferencesId)) { return; }
    const related_node = _resolveReferenceNode(addressSpace,reference);
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

    const self = this;
    const _private = BaseNode_getPrivate(self);

    if (self.addressSpace.suspendBackReference) {

        // this indicates that the base node is constructed from an xml definition
        // propagate_back_references will be called later once the file has been completely processed.
        return;
    }
    const addressSpace = self.addressSpace;
    _.forEach(_private._referenceIdx,function (reference) {
        _propagate_ref(self, addressSpace, reference);
    });
};


const cetools = require("./address_space_change_event_tools");


function _handle_HierarchicalReference(node,reference) {

    const _private = BaseNode_getPrivate(node);
     if (_private._cache._childByNameMap) {
        const addressSpace = node.addressSpace;
        const referenceType = Reference._resolveReferenceType(addressSpace,reference);

        if (referenceType) {

            const HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");

            //xx console.log ("HierarchicalReferencesType",HierarchicalReferencesType.toString());
            if (referenceType.isSupertypeOf(HierarchicalReferencesType)) {
                assert(reference.isForward);
                const targetNode = Reference._resolveReferenceNode(addressSpace,reference);
                //Xx console.log(" adding object to map");
                _private._cache._childByNameMap[targetNode.browseName.toString()] = targetNode;
            }
        }
    }
}
function _remove_HierarchicalReference(node,reference) {

    const _private = BaseNode_getPrivate(node);
    if (_private._cache._childByNameMap) {
        const addressSpace = node.addressSpace;
        const referenceType = Reference._resolveReferenceType(addressSpace,reference);

        if (referenceType) {
            const HierarchicalReferencesType = addressSpace.findReferenceType("HierarchicalReferences");
            if (referenceType.isSupertypeOf(HierarchicalReferencesType)) {
                assert(reference.isForward);
                const targetNode = Reference._resolveReferenceNode(addressSpace,reference);
                //Xx console.log(" adding object to map");
                delete _private._cache._childByNameMap[targetNode.browseName.toString()];
            }
        }
    }
}

BaseNode.prototype.__addReference = function (reference) {

    const self = this;
    const _private = BaseNode_getPrivate(self);

    assert(reference.hasOwnProperty("referenceType"));
    //xx isForward is optional : assert(reference.hasOwnProperty("isForward"));
    assert(reference.hasOwnProperty("nodeId"));

    const addressSpace = self.addressSpace;
    reference = addressSpace.normalizeReferenceTypes([reference])[0];

    const h = reference.hash;
    assert(!_private._back_referenceIdx[h],"reference exists already in _back_references");
    assert(!_private._referenceIdx[h],"reference exists already in _references");

///    self._references.push(reference);
    _private._referenceIdx[h] = reference;
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

    const self = this;

    reference = self.__addReference(reference);

    const addressSpace = this.addressSpace;
    if (!_resolveReferenceType(addressSpace,reference)) {
       throw new Error("BaseNode#addReference : invalid reference  " + reference.toString());
    }
    self._clear_caches();

    _propagate_ref(self, addressSpace, reference);
    self.install_extra_properties();
    cetools._handle_add_reference_change_event(self,reference.nodeId);

};

/***
 * @method removeReference
 * @param reference
 * @return void
 */
BaseNode.prototype.removeReference = function(reference) {

    const self = this;
    const _private = BaseNode_getPrivate(self);

    assert(reference.hasOwnProperty("referenceType"));
    //xx isForward is optional : assert(reference.hasOwnProperty("isForward"));
    assert(reference.hasOwnProperty("nodeId"));

    const addressSpace = self.addressSpace;
    reference = addressSpace.normalizeReferenceTypes([reference])[0];
    const h = reference.hash;

    const relatedNode = addressSpace.findNode(reference.nodeId);

    const invReference = new Reference({
        referenceType: reference.referenceType,
        isForward: !reference.isForward,
        nodeId: self.nodeId
    });


    if (_private._referenceIdx[h]) {
        delete _private._referenceIdx[h];
        relatedNode._remove_backward_reference(invReference);

    } else if (_private._back_referenceIdx[h]) {

        relatedNode.removeReference(invReference);
    } else {
        throw new Error("Cannot find reference " + reference);
    }

    _handle_HierarchicalReference(self,reference);

    self.uninstall_extra_properties(reference);

    self._clear_caches();

};

/**
 * Undo the effect of propagate_back_references
 * @method unpropagate_back_references
 * @private
 */
BaseNode.prototype.unpropagate_back_references = function () {

    const self = this;
    const _private = BaseNode_getPrivate(self);

    const addressSpace = self.addressSpace;
    //xx assert(addressSpace instanceof AddressSpace);
    _.forEach(_private._referenceIdx,function (reference) {

        // filter out non  Hierarchical References
        const referenceType = _resolveReferenceType(addressSpace,reference);

        // istanbul ignore next
        if (!referenceType) {
            console.error(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString());
        }

        const related_node = _resolveReferenceNode(addressSpace,reference);
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
    const self = this;
    const _private = BaseNode_getPrivate(self);
    _private._cache = {};
};

BaseNode.prototype._on_child_added = function(/*obj*/) {
    const self = this;
    self._clear_caches();
};

BaseNode.prototype._on_child_removed = function(/*obj*/) {
    const self = this;
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
 * @param context {SessionContext}
 * @param attributeId {AttributeId}
 * @param [indexRange {NumericRange}]
 * @param [dataEncoding {String}]
 * @return {DataValue}
 */
BaseNode.prototype.readAttribute = function (context, attributeId, indexRange, dataEncoding) {

    assert(context instanceof SessionContext);
    const options = {};
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
 * @param context {SessionContext}
 * @param writeValue {Object}
 * @param writeValue.attributeId {AttributeId}
 * @param writeValue.dataValue {DataValue}
 * @param writeValue.indexRange {NumericRange}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 */
BaseNode.prototype.writeAttribute = function (context, writeValue, callback) {

    assert(context instanceof SessionContext);
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
        const parent = this.addressSpace.findNode(this.parentNodeId);

        // istanbul ignore else
        if (parent) {
            return parent.full_name() + "." + this.browseName.toString() + "";
        } else {
            return "NOT YET REGISTERED" + this.parentNodeId.toString() + "." + this.browseName.toString() + "";
        }
    }
    return this.browseName.toString();
};

BaseNode.prototype.allReferences = function() {

    const self = this;
    const _private = BaseNode_getPrivate(self);
    return [].concat(_.map(_private._referenceIdx),_.map(_private._back_referenceIdx));

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

    const self = this;
    const _private = BaseNode_getPrivate(self);


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


    const references = self.allReferences();

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
        const referenceType = _resolveReferenceType(self.addressSpace,reference);
        const referenceTypeId = referenceType.nodeId;

        if (sameNodeId(relativePathElement.referenceTypeId,referenceTypeId)) {
            return true;
        }
        if (relativePathElement.includeSubtypes) {
            const baseType = self.addressSpace.findNode(relativePathElement.referenceTypeId);
            if(baseType && referenceType.isSupertypeOf(baseType)) {
                return true;
            }
        }
        return false;
    }

    const nodeIdsMap = {};
    let nodeIds = [];

    for (const reference of references) {

        if (!_check_reference(reference)) {
            continue;
        }

        const obj = _resolveReferenceNode(self.addressSpace,reference);

        // istanbul ignore next
        if (!obj) {
            throw new Error(" cannot find node with id ", reference.nodeId.toString());
        }

        if (_.isEqual(obj.browseName, relativePathElement.targetName)) { // compare QualifiedName
            const key = obj.nodeId.toString();
            if (!nodeIdsMap.hasOwnProperty(key)) {
                nodeIds.push(obj.nodeId);
                nodeIdsMap[key] = obj;
            }
        }
    }
    if (self.subtypeOf) {
        // browsing also InstanceDeclarations included in base type
        const baseType = self.addressSpace.findNode(self.subtypeOf);
        const n = baseType.browseNodeByTargetName(relativePathElement,isLast);
        nodeIds = [].concat(nodeIds, n);
    }
    return nodeIds;
};

const check_flag = require("node-opcua-utils").check_flag;
const rm = ResultMask;


function _makeReferenceDescription(addressSpace, reference, resultMask) {

    const isForward = reference.isForward;

    const referenceTypeId =  _resolveReferenceType(addressSpace,reference).nodeId;
    assert(referenceTypeId instanceof NodeId);

    const obj = _resolveReferenceNode(addressSpace,reference);

    let data = {};

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
    const referenceDescription = new ReferenceDescription(data);
    return referenceDescription;
}

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
        const referenceType = addressSpace.findNode(referenceTypeId);
        return referenceTypeId.toString() + " " + referenceType.browseName.toString() + "/" + referenceType.inverseName.text;
    }
}

function nodeIdInfo(addressSpace, nodeId) {

    const obj = addressSpace.findNode(nodeId);
    const name = obj ? obj.browseName.toString() : " <????>";
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
        const ref = addressSpace.findReferenceType(referenceTypeId);
        if (ref) {
            return ref.nodeId;
        }
    }
    let nodeId;
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

    const addressSpace = node.addressSpace;

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
 * @param references  {Array<Reference>|null}
 * @static
 */
function dumpReferences(addressSpace, references) {

    assert(addressSpace);

    _.forEach(references,function (reference) {

        const referenceType = Reference._resolveReferenceType(addressSpace,reference);
        if (!referenceType) {
            // unknown type ... this may happen when the address space is not fully build
            return;
        }
        const dir = reference.isForward ? "(=>)" : "(<-)";
        const objectName = nodeIdInfo(addressSpace, reference.nodeId);

        console.log(" referenceType : ", dir, referenceType ? referenceType.browseName.toString() : reference.referenceType.toString(), " ", objectName);
    });
}

exports.dumpBrowseDescription = dumpBrowseDescription;
exports.dumpReferences = dumpReferences;

const _resolveReferenceNode = Reference._resolveReferenceNode;
const _resolveReferenceType = Reference._resolveReferenceType;


function _filter_by_referenceType(self, browseDescription, references, referenceTypeId) {

    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {

        assert(referenceTypeId instanceof NodeId);
        const referenceType = self.addressSpace.findNode(referenceTypeId);

        dumpIf(!referenceType, referenceTypeId);
        assert(referenceType instanceof ReferenceType);

        references = references.filter(function (reference) {

            // xxx if (reference.referenceType === "HasSubtype"){ return false;  }
            /// var ref = self.addressSpace.findReferenceType(reference.referenceType);
            const ref = _resolveReferenceType(self.addressSpace,reference);

            if (!ref) {
                return false;
            } // unknown type ... this may happen when the address space is not fully build
            assert(ref instanceof ReferenceType);

            const is_of_type = ref.nodeId.toString() === referenceType.nodeId.toString();
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
    const addressSpace = self.addressSpace;
    return references.filter(function (reference) {

        const obj = _resolveReferenceNode(addressSpace,reference);

        if (!obj) {
            return false;
        }

        const nodeClassName = obj.nodeClass.key;

        const value = makeNodeClassMask(nodeClassName);
        return (value & nodeClassMask ) === value;

    });
}

function _filter_by_userFilter(self, references, session) {

    const addressSpace = self.addressSpace;
    return references.filter(function (reference) {

        const obj = _resolveReferenceNode(addressSpace,reference);

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

    const do_debug = false;

    //xx do_debug = ( this.browseName === "Server" );

    const self = this;
    const _private = BaseNode_getPrivate(self);

    const referenceTypeId = normalize_referenceTypeId(this.addressSpace, browseDescription.referenceTypeId);
    assert(referenceTypeId instanceof NodeId);

    const browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    const addressSpace = self.addressSpace;

    // get all possible references
    let references = [].concat(_.map(_private._referenceIdx),_.map(_private._back_referenceIdx));

    /* istanbul ignore next */
    if (do_debug) {
        console.log("all references :", self.nodeId.toString(), self.browseName.toString());
        dumpReferences(addressSpace, _.map(_private._referenceIdx));
    }

    // filter out references not matching referenceType
    references = _filter_by_referenceType(self, browseDescription, references, referenceTypeId);

    references = _filter_by_direction(references, browseDirection);

    references = _filter_by_nodeclass(self, references, browseDescription.nodeClassMask);

    references = _filter_by_userFilter(self, references, session);

    const referenceDescriptions = _constructReferenceDescription(addressSpace, references, browseDescription.resultMask);

    /* istanbul ignore next */
    if (do_debug) {
        dumpReferenceDescriptions(self.addressSpace, referenceDescriptions);
    }

    return referenceDescriptions;
};

/*
 * install hierarchical references as javascript properties
 * Components/Properties/Organizes
 */
function install_components_as_object_properties(parentObj) {

    if (!parentObj) {
        return;
    }

    const addressSpace = parentObj.addressSpace;
    const hierarchicalRefs = parentObj.findHierarchicalReferences();

    const children = hierarchicalRefs.map(function(r){
        return _resolveReferenceNode(addressSpace,r);
    });

    for (const child of children) {

        if (!child) {
            continue;
        }
        // assumption: we ignore namespace here .
        const name = lowerFirstLetter(child.browseName.name.toString());


        if (reservedNames.hasOwnProperty(name)) {
           if (doDebug) {console.log(("Ignoring reserved keyword                                               "+ name).bgWhite.red);}
            continue;
        }
        /* istanbul ignore next */
        if (parentObj.hasOwnProperty(name)) {
            continue;
        }

        Object.defineProperty(parentObj, name, {
            enumerable: true,
            configurable: true, // set to true, so we can undefine later
            //xx writable: false,
            get: function () {
                return child;
            }
            //value: child
        });
    }
}

BaseNode.prototype.install_extra_properties = function () {

    const self = this;
    const addressSpace = self.addressSpace;

    if (addressSpace.isFrugal) {
        // skipping
        return;
    }

    install_components_as_object_properties(self);

    function install_extra_properties_on_parent(ref) {
        const node = Reference._resolveReferenceNode(addressSpace,ref);
        install_components_as_object_properties(node);
    }
    // make sure parent have extra properties updated
    const components = self.findReferences("HasComponent", false);
    const subfolders = self.findReferences("Organizes", false);
    const properties = self.findReferences("HasProperty", false);
    components.forEach(install_extra_properties_on_parent);
    subfolders.forEach(install_extra_properties_on_parent);
    properties.forEach(install_extra_properties_on_parent);
};


BaseNode.prototype.uninstall_extra_properties = function (reference) {
    const self = this;
    const addressSpace = self.addressSpace;

    if (addressSpace.isFrugal) {
        // skipping
        return;
    }
    const childNode =_resolveReferenceNode(addressSpace,reference);

    const name = lowerFirstLetter(childNode.browseName.name.toString());
    if (reservedNames.hasOwnProperty(name)) {
        if (doDebug) {console.log(("Ignoring reserved keyword                                               "+ name).bgWhite.red);}
        return;
    }
    /* istanbul ignore next */
    if (!self.hasOwnProperty(name)) {
        return;
    }

    Object.defineProperty(self, name, {
       value: undefined
    });
};



function _clone_collection_new(newParent,collectionRef,optionalFilter, extraInfo) {

    const addressSpace = newParent.addressSpace;
    assert(!optionalFilter || (_.isFunction(optionalFilter.shouldKeep) && _.isFunction(optionalFilter.filterFor)) );

    collectionRef.forEach(function (reference) {

        const node = _resolveReferenceNode(addressSpace,reference);

        // ensure node is of the correct type,
        // it may happen that the xmlnodeset2 file was malformed

        // istanbul ignore next
        if (!_.isFunction(node.clone)) {
            console.log("Warning : cannot clone node ".red + node.browseName.toString() + " of class " + node.nodeClass.toString()," while cloning ",newParent.browseName.toString());
            return;
        }

        if (optionalFilter && !optionalFilter.shouldKeep(node)) {
            return ; // skip this node
        }

        const options = {
            references: [
                {referenceType: reference.referenceType, isForward: false, nodeId: newParent.nodeId}
            ]
        };

        const clone = node.clone(options,optionalFilter,extraInfo);

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

    const self = this;
    assert(newParent instanceof BaseNode);
    // find all reference that derives from the HasChild
    const aggregatesRef = self.findReferencesEx("Aggregates", BrowseDirection.Forward);
    _clone_collection_new(newParent,aggregatesRef, optionalFilter, extraInfo);

};

/**
 * @method _clone
 * @param Constructor {Function}
 * @param options {Object}
 * @param extraInfo
 * @return {*}
 * @private
 */
BaseNode.prototype._clone = function (Constructor, options,optionalfilter, extraInfo) {

    const self = this;

    assert(_.isFunction(Constructor));
    assert(_.isObject(options));
    assert(!extraInfo || (_.isObject(extraInfo) && _.isFunction(extraInfo.registerClonedObject)));
    assert(!self.subtypeOf,"We do not do cloning of Type yet");

    options = _.extend(options, {
        addressSpace: self.addressSpace,
        browseName:   self.browseName,
        displayName:  self.displayName,
        description:  self.description
    });
    options.references = options.references || [];
    if (self.typeDefinition) {
        options.references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: self.typeDefinition});
    }

    if (self.modellingRule) {
        const modellingRuleNode = self.findReferencesAsObject("HasModellingRule")[0];
        assert(modellingRuleNode);
        {
            options.references.push({referenceType: "HasModellingRule", isForward: true, nodeId: modellingRuleNode.nodeId});
        }
    }


    options.nodeId = self.addressSpace._construct_nodeId(options);
    assert(options.nodeId instanceof NodeId);

    const cloneObj = new Constructor(options);
    self.addressSpace._register(cloneObj);

    const newFilter = optionalfilter? optionalfilter.filterFor(cloneObj) :null;
    self._clone_children_references(cloneObj,newFilter,extraInfo);

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

    const str = [];
    const self = this;

    if (options ) {
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

    const add = options.add;
    const indent = options.indent;

    const self = this;
    const _private = BaseNode_getPrivate(self);


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

        const addressSpace = self.addressSpace;
        const d = addressSpace.findNode(self.dataType);
        const n = d ? "(" + d.browseName.toString() + ")" : " (???)";
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


    add(options.padding + "          references    : ".yellow + "  length =" + Object.keys(_private._referenceIdx).length);

    const dispOptions = {
        addressSpace: self.addressSpace
    };


    function dump_reference(follow,reference) {
        //xx if (!reference.isForward) {
        //xx     return;
        //xx }
        const o = _resolveReferenceNode(self.addressSpace,reference);
        const name = o ? o.browseName.toString() : "<???>";
        add(options.padding + "               +-> ".yellow + reference.toString(dispOptions) + " " + name.cyan);

        // ignore HasTypeDefinition as it has been already handled
        if (reference.referenceType === "HasTypeDefinition" && reference.nodeId.namespace === 0) {
            return;
        }
        if (o) {
            if (!is_already_processed(o.nodeId)) {
                set_as_processed(o.nodeId);
                if (options.level > 1 && follow) {
                    const rr = o.toString({
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
    _.forEach(_private._referenceIdx,dump_reference.bind(null,true));

    const br = _.map(_private._back_referenceIdx);
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

    const self = this;
    const _private = BaseNode_getPrivate(self);

    self.emit("dispose");

    self.removeAllListeners();
    self._clear_caches();

    _.forEach(_private._back_referenceIdx,function(ref){ ref.dispose(); });
    _.forEach(_private._referenceIdx,function(ref){ ref.dispose(); });
    _private._cache = {};
    _private.__address_space = null;
    _private._back_referenceIdx = null;
    _private._referenceIdx = null;

};


exports.BaseNode = BaseNode;
ReferenceType = require("./referenceType").ReferenceType;


/**
 * @property modellingRule
 * @type {String|undefined}
 */
BaseNode.prototype.__defineGetter__("modellingRule",function() {
    const node = this;
    let r = node.findReferencesAsObject("HasModellingRule");
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
    const node = this;
    let r = node.findReferencesAsObject("HasTrueSubState",false);
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
    const node = this;
    let r = node.findReferencesAsObject("HasFalseSubState",false);
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

    const node  = this;
    const _private = BaseNode_getPrivate(node);

    if (!_private._cache._HasChildReferences) {
        //xx console.log("node ",node.nodeId.toString());
        //xx _private._cache._HasChildReferences =  node.findReferencesEx("HierarchicalReferences",BrowseDirection.Forward);
        const r1 = node.findReferencesEx("HasChild",BrowseDirection.Forward);
        const r2 = node.findReferencesEx("Organizes",BrowseDirection.Forward);
        _private._cache._HasChildReferences = r1.concat(r2);
    }
    return _private._cache._HasChildReferences;
};

BaseNode.prototype.getChildByName = function(browseName) {

    const node = this;
    const _private = BaseNode_getPrivate(node);

    browseName = browseName.toString();

    const addressSpace = node.addressSpace;

    if (!_private._cache._childByNameMap) {
        _private._cache._childByNameMap = {};

        const childrenRef = node.findHierarchicalReferences();
        _.forEach(childrenRef,function(r){
            const child = _resolveReferenceNode(addressSpace,r);
            _private._cache._childByNameMap[child.browseName.toString()] = child;
        });
    }
    const ret = _private._cache._childByNameMap[browseName] || null;
    return ret;
};


BaseNode.prototype.__defineGetter__("addressSpace",function(){
   const self = this;
   const _private = BaseNode_getPrivate(self);
   return _private.__address_space;
});

BaseNode.prototype.installPostInstallFunc = function(f) {

    if (!f) {
        // nothing to do
        return;
    }
    const self = this;

    function chain(f1,f2) {
        return function() {
            const args = arguments;
            if(f1) {
                f1.apply(this,args);
            }
            if (f2) {
                f2.apply(this,args);
            }
        };
    }
    self._postInstantiateFunc = chain(self._postInstantiateFunc,f);
};
