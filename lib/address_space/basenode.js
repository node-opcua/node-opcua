"use strict";

/*jslint bitwise: true */
/**
 * @module opcua.address_space
 */
require("requirish")._(module);

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

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;
var assert = require("better-assert");
var _ = require("underscore");
var dumpIf = require("lib/misc/utils").dumpIf;
var ReferenceType =null;// will be defined after baseNode is defined

var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;


function is_valid_reference(ref) {
    return ref.hasOwnProperty("referenceType") &&
        ref.hasOwnProperty("nodeId") &&
        ref.isForward !== null;
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
function Reference(options)
{
    this.referenceType = options.referenceType;
    this.isForward = options.isForward;
    this.nodeId = options.nodeId;
    assert(is_valid_reference(this));
}

/**
 * @method toString
 * @return {String}
 */
Reference.prototype.toString = function() {
    return "REF{ " + this.nodeId.toString() + " " + ( this.isForward ? "=>" : "<-" ) + this.referenceType +" }" ;
};

function find_reference(referenceArray, referenceToFind) {
    assert(_.isArray(referenceArray));

    var found = referenceArray.filter(function (ref) {
        if (ref === referenceToFind) { return true;}
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
        if (!ref) {
            console.log(" cannot find reference", reference.referenceType ," ref = ",ref);
        }
        assert(_.isObject(ref)); // referenceType must exists
    });
}



function normalizeReferenceTypes(addressSpace,references) {
    references = references.map(function (reference) { return addressSpace.normalizeReferenceType(reference); });
    _check_reference_type_validity(addressSpace, references);
    references = references.map(function(o) { return new Reference(o); });
    return references;
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
 *
 */
function BaseNode(options) {

    assert(this.nodeClass);
    assert(options.address_space); // expecting an address space
    options.references = options.references || [];

    Object.defineProperty(this, "__address_space", { value: options.address_space, enumerable: false });

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    // re-use browseName as displayName if displayName is missing
    options.displayName = options.displayName || options.browseName;

    this.displayName = [];

    this.displayName.push(coerceLocalizedText(options.displayName));

    this.description  = options.description ?     coerceLocalizedText(options.description) : null;

    // normalize reference type
    // this will convert any referenceType expressed with its inverseName into
    // its normal name and fix the isForward flag accordingly.
    // ( e.g "ComponentOfTy" isForward:true => "HasComponent", isForward:true)
    this._references = normalizeReferenceTypes(this.__address_space,options.references);

    this._back_references = [];

    this._cache = {};

    _setup_parent_item.call(this, options.references);

}

/**
 * @method findReferences
 * @param strReference {String} the referenceType as a string.
 * @param isForward {Boolean|null}
 * @return {Array.<Reference>}
 */
BaseNode.prototype.findReferences = function(strReference, isForward)
{
    isForward = (isForward === null || isForward === undefined) ? true : isForward;
    assert(isForward === true || isForward === false);
    assert(this._references);

    var refs1 = _.filter(this._references, function (ref) {
        return ref.referenceType === strReference && ref.isForward === isForward;
    });
    var refs2 = _.filter(this._back_references, function (ref) {
        return ref.referenceType === strReference && ref.isForward === isForward;
    });

    return [].concat(refs1,refs2);
};

/**
 * @method findReference
 * @param strReference {String} the referenceType as a string.
 * @param [isForward] {Boolean|null}
 * @return {Reference}
 */
BaseNode.prototype.findReference = function(strReference, isForward)
{
   var refs = this.findReferences(strReference,isForward);
    assert(refs.length === 1 || refs.length === 0 , "findReference: expecting only one or zero element here");
    return refs.length === 0 ? null : refs[0];
};


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
                assert(browseResults.length === 1);
                this._cache.parent = browseResults[0].nodeId;
            }
            //xx else { console.log(" warning cannot find parent for ...", this.browseName);  }
        }
    }
}


/**
 * returns the nodeId of this node's Type Definition
 * @property hasTypeDefinition {NodeId}
 */
BaseNode.prototype.__defineGetter__("hasTypeDefinition", function () {
    if (!this._cache.hasTypeDefinition){
        var has_type_definition_ref = this.findReference( "HasTypeDefinition", true);
        this._cache.hasTypeDefinition = has_type_definition_ref ? has_type_definition_ref.nodeId : null;
    }
    return this._cache.hasTypeDefinition;
});

BaseNode.prototype.findReferencesAsObject = function (strReference, isForward) {

    var componentsIds = this.findReferences(strReference,isForward);
    var address_space = this.__address_space;

    function toObject(reference) {
        return address_space.findObject(reference.nodeId);
    }
    return componentsIds.map(toObject);
};


BaseNode.prototype.getComponents = function() {
    if (!this._components) {
        this._components = this.findReferencesAsObject("HasComponent",true);
    }
    return this._components;
};

BaseNode.prototype.getProperties = function() {
    if (!this._properties) {
        this._properties = this.findReferencesAsObject("HasProperty",true);
    }
    return this._properties;
};

BaseNode.prototype.getPropertyByName = function(browseName) {

    var properties = this.getProperties ();
    var select = properties.filter(function(c){ return c.browseName === browseName; });
    return  select.length === 1 ? select[0] : null;
};

/**
 *
 * @method getMethods
 * @return {Array<UAObject>} returns an array with Method objects.
 */
BaseNode.prototype.getMethods = function() {

    if (!this._methods) {
        var components = this.getComponents();
        var Method = require("lib/address_space/method").Method;
        this._methods = components.filter(function(obj){ return obj instanceof Method; });
    }
    return this._methods;
};

/**
 * returns true if the object has some opcua methods
 * @property hasMethods
 * @type {Boolean}
 */
BaseNode.prototype.__defineGetter__("hasMethods", function () {
    return this.getMethods().length>0;
});

/**
 * @method getMethodById
 * @param nodeId
 * @return {*}
 */
BaseNode.prototype.getMethodById = function( nodeId) {

    var methods = this.getMethods();
    return _.find(methods,function(m){return m.nodeId.toString() === nodeId.toString();});
};


/**
 * returns the nodeId of the DataType which is the super type of this
 * @property subTypeOf
 * @param {NodeId}
 */
BaseNode.prototype.__defineGetter__("subTypeOf", function () {

    if (!this._cache.is_subtype_of) {
        var is_subtype_of_ref = this.findReference("HasSubtype", false);
        this._cache.is_subtype_of = is_subtype_of_ref ? is_subtype_of_ref.nodeId : null;
    }
    return this._cache.is_subtype_of;
});

/**
 * @property parent {BaseNode} - the parent node
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


BaseNode.prototype._add_backward_reference = function (reference) {

    var self = this;
    assert(is_valid_reference(reference));
    // make sure we keep reference integrity
    assert((find_reference(self._back_references, reference).length === 0) && " reference exists already in _back_references");
    if (find_reference(self._references, reference).length > 0) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <Reference>
        //  in this case there is nothing to do
        return;
    }

    self._back_references.push(reference);

};

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

        // filter out non  Hierarchical References
        var referenceType = address_space.findReferenceType(reference.referenceType);

        if (!referenceType) {
            console.log(" ERROR".red, " cannot find reference ", reference.referenceType, reference.toString()  );
        }

        //xx if (!referenceType.isSubtypeOf(hierarchicalReferencesId)) { return; }

        var related_node = address_space.findObject(reference.nodeId);
        if (related_node) {
            assert(reference.nodeId.toString() !== self.nodeId.toString());

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
    });
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
            options.value = { dataType: DataType.NodeId, value: this.nodeId };
            break;

        case AttributeIds.NodeClass: // NodeClass
            assert(_.isFinite(this.nodeClass.value));
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
            options.value = { dataType: DataType.LocalizedText, value: this.description };
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
            options.value = null;
            console.log("class Name ",this.constructor.name,(" BaseNode : '" + this.browseName +"' nodeid=" + this.nodeId.toString()).yellow, " cannot get attribute ",AttributeNameById[attributeId],"(",attributeId,")");
            options.statusCode = StatusCodes.BadAttributeIdInvalid;
            break;
    }
    return new DataValue(options);
};

/**
 * @method writeAttribute
 * @param attributeId {AttributeId}
 * @param dataValue {DataValue}
 * @param callback {Function}
 * @param callback.err {Error|null}
 * @param callback.statusCode {StatusCode}
 * @async
 */
BaseNode.prototype.writeAttribute = function (attributeId, dataValue , callback) {
    assert(_.isFunction(callback));
    assert(attributeId && dataValue);
    // by default Node is read-only,
    // this method needs to be overridden to change the behavior
    callback(null,StatusCodes.BadNotWritable);
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
            return parent.full_name() + "." + this.browseName + "";
        } else {
            return "NOT YET REGISTERED" + this.parentNodeId.toString() + "." + this.browseName + "";
        }
    }
    return this.browseName;
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

        if (!obj) {throw new Error(" cannot find node with id ", reference.nodeId.toString()); }

        if (obj.browseName === relativePath.targetName.name) {
            nodeIds.push(obj.nodeId);
        }
    });

    return nodeIds;
};

var _makeReferenceDescription = function (address_space, reference) {

    var isForward = reference.isForward;

    var referenceTypeId = address_space.findReferenceType(reference.referenceType).nodeId;
    assert(referenceTypeId instanceof NodeId);

    var obj = address_space.findObject(reference.nodeId);

    var data = {};

    if (!obj) {
        // cannot find reference node
        data = {
            referenceTypeId: referenceTypeId,
            isForward: isForward,
            nodeId: reference.nodeId
        };
    } else {
        assert(reference.nodeId, obj.nodeId);
        data = {
            referenceTypeId: referenceTypeId,
            isForward: isForward,
            nodeId: obj.nodeId,
            browseName: coerceQualifyName(obj.browseName),
            displayName: coerceLocalizedText(obj.displayName[0]),
            nodeClass: obj.nodeClass,
            typeDefinition: obj.hasTypeDefinition
        };
    }
    if (data.typeDefinition === null) {
        data.typeDefinition = resolveNodeId("i=0");
        //xx console.log("typeDefinition === null" , util.inspect(obj,{colors:true,depth:10}));
    }
    assert(data.referenceTypeId instanceof NodeId);
    var result = new browse_service.ReferenceDescription(data);
    assert(result.referenceTypeId instanceof NodeId);

    return result;
};

function _constructReferenceDescription(address_space, references) {
    //x assert(address_space instanceof AddressSpace);
    assert(_.isArray(references));
    return references.map(function (reference) {
        return _makeReferenceDescription(address_space, reference, true);
    });
}

function referenceTypeToString(address_space, referenceTypeId) {

    if (!referenceTypeId) {
        return "<null> ";
    } else {
        var referenceType = address_space.findObject(referenceTypeId);
        return referenceTypeId.toString() + " " + referenceType.browseName + "/" + referenceType.inverseName.text;
    }
}

function nodeIdInfo(address_space, nodeId) {

    var obj = address_space.findObject(nodeId);
    var name = obj ? obj.browseName : " <????>";
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
    console.log("    browseName      : ", referenceDescription.browseName);
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

        console.log(" referenceType : ", dir, ref ? ref.browseName : reference.referenceType.toString(), " ", objectName);
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
            if (!ref) { return false;} // unknown type ... this may happen when the address space is not fully build
            dumpIf(!ref, reference);
            assert(ref instanceof ReferenceType);

            var is_of_type = ref.nodeId.toString() === referenceType.nodeId.toString();
            if (browseDescription.includeSubtypes) {
                return ref.isSubtypeOf(referenceType) || is_of_type;
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
    if (browseDirection === BrowseDirection.Forward ) {
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

    if (do_debug) {
        dumpBrowseDescription(self, browseDescription);
    }

    var referenceTypeId = normalize_referenceTypeId(this.__address_space, browseDescription.referenceTypeId);
    assert(referenceTypeId instanceof NodeId);

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    var address_space = self.__address_space;

    // get all possible references
    var references = self._references.concat(self._back_references);

    if (do_debug) {
        console.log("all references :", self.nodeId.toString(), self.browseName) ;
        dumpReferences(address_space, self._references);
    }

    // filter out references not matching referenceType
    references = _filter_by_referenceType(self, browseDescription, references, referenceTypeId);

    references = _filter_by_direction(references, browseDirection);

    references = _filter_by_nodeclass(self, references, browseDescription.nodeClassMask);

    var referenceDescriptions = _constructReferenceDescription(address_space, references);

    if (do_debug) {
        dumpReferenceDescriptions(self.__address_space, referenceDescriptions);
    }

    return referenceDescriptions;
};

function install_components_as_object_properties(parentObj) {


    var a1 = parentObj.findReferencesAsObject("Organizes");
    var a2 = parentObj.findReferencesAsObject("HasComponent");
    var a3 = parentObj.findReferencesAsObject("HasProperty");

    var children = a1.concat(a2,a3);



    children.forEach(function(child) {

        if(!child) { return;}

        var name = lowerFirstLetter(child.browseName);


        if(parentObj.hasOwnProperty(name)) {
            console.log(" parent has already a property named "+name);
            throw new Error(" parent has already a property named "+name);
        }
        //xxx console.log(parentObj.browseName + " adding property "+name);

        Object.defineProperty(parentObj, name, {
            enumerable: true,
            configurable: false,
            //xx writable: false,
            get: function() {
                return child;
            }
            //value: child
        });
    });
}

BaseNode.prototype.install_extra_properties = function() {
    install_components_as_object_properties(this);
};


exports.BaseNode = BaseNode;
ReferenceType = require("lib/address_space/referenceType").ReferenceType;
