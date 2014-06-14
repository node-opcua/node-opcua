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
 * verifies that references are existing referenceType. This function
 * will assert for instance if a referenceType is given by it's inverse name.
 *
 * @param address_space
 * @param references
 * @private
 */
function _check_reference_type_validity(address_space,references)
{
   // assert( address_space instanceof AddressSpace);
    _.forEach(references,function(reference){

        assert(reference.hasOwnProperty("referenceType"));
        if (reference.referenceType === "HasSubtype" || reference.referenceType === "HasTypeDefinition") {
            return; // this reference type is known to be correct
        }

        var ref = address_space.findReferenceType(reference.referenceType);
        if (!ref) { console.log(" cannot find reference",reference.referenceType);}
        assert(ref != null); // referenceType must exists
    });
}



/**
 *
 */
function findReferencesOfType(address_space,references,base_referenceType) {

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
 *
 *
 * @constructor
 *
 * BaseNode is the base class for all the OPCUA objects in the address space
 * It provides attributes and a set of references to other nodes.
 *
 */
function BaseNode(options) {

    assert(options.address_space); // expecting an address space
    options.references = options.references || [];

    Object.defineProperty(this, "__address_space", { value: options.address_space, enumerable: false });

    this.nodeId = resolveNodeId(options.nodeId);

    this.browseName = options.browseName;

    options.displayName = options.displayName || options.browseName; // xx { locale: "en", text: options.browseName };

    this.displayName = [];

    // todo: add better coercion here.
    if (typeof options.displayName === "string") {
        this.displayName.push(new s.LocalizedText({ locale: null, text: options.displayName }));
    } else {
        this.displayName.push(new s.LocalizedText({ locale: null, text: "<invalid display name>" }));
    }

    // normalize reference type
    // this will convert any referenceType expressed with its inverseName into
    // its normal name and fix the isForward flag accordingly.
    // ( e.g "ComponentOf" isForward:true => "HasComponent", isForward:true)
    options.references = options.references.map(function(reference){
       return options.address_space.normalizeReferenceType(reference);
    });

    _check_reference_type_validity(this.__address_space,options.references);

    this.references = options.references;
    this.back_references = [];

    this._cache = {};

    var has_type_definition_ref = findReference(options, "HasTypeDefinition", true);
    this._cache.hasTypeDefinition = has_type_definition_ref ? has_type_definition_ref.nodeId : null;

    if (options.references.length>0) {
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
            if (browseResults.length>=1) {
                assert(browseResults.length===1);
                // xxconsole.log(" parent is ",browseResults[0]);
                this._cache.parent = browseResults[0].nodeId;
            }
            //xx var organizes_ref = findReference(options, "Organizes", false);
            //xx this._cache.parent = organizes_ref ? organizes_ref.nodeId : null;

        }
    }

    dumpIf(!this.nodeClass, this);
    assert(this.nodeClass);
}

/**
 * returns the nodeId of this node's Type Definition
 * @property hasTypeDefinition {ReferenceType}
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
 * @return {NodeId}
 */
BaseNode.prototype.resolveNodeId = function(nodeId) {
    return this.__address_space.resolveNodeId(nodeId);
};

function is_valid_reference(ref) {
    return ref.hasOwnProperty("referenceType") &&
           ref.hasOwnProperty("nodeId")  &&
           ref.isForward !== null;
}

function same_reference(r1,r2) {
    assert(is_valid_reference(r1));
    assert(is_valid_reference(r2));
    return r1.referenceType === r2.referenceType &&
           r1.nodeId.toString() === r2.nodeId.toString();
}

function find_reference(referenceArray,referenceToFind) {
    assert(_.isArray(referenceArray));

    var found = referenceArray.filter(function(ref){
        if (ref === referenceToFind) return true;
        if (same_reference(ref,referenceToFind)) return true;
        return false;
    });
    //xx if (found.length) { console.log(JSON.stringify(found,null," ").yellow);}
    return found;
}


BaseNode.prototype._add_backward_reference = function(reference) {

    var self = this;
    assert(is_valid_reference(reference));
    // make sure we keep reference integrity
    assert((find_reference(self.back_references,reference).length===0) && " reference exists already in back_references");
    if (find_reference(self.references,reference).length > 0) {
        //  the reference exists already in the forward references
        //  this append for instance when the XML NotSetFile has redundant <Reference>
        //  in this case there is nothing to do
        return;
    }
    self.back_references.push(reference);

};

/**
 * this methods propagates the forward references to the pointed node
 * by inserting backward references to the counter part node
 *
 * @method propagate_back_references
 * @param address_space {AddressSpace}
 */
BaseNode.prototype.propagate_back_references = function(address_space) {

    // assert(address_space instanceof AddressSpace);
    var self = this;

    var hierarchicalReferencesId = address_space.findReferenceType("HierarchicalReferences");

    self.references.forEach(function(reference){

        // filter out non  Hierarchical References
        var referenceType = address_space.findReferenceType(reference.referenceType);

        if (!referenceType) {
            //
            console.log(" ERROR".red, " cannot find reference ", reference.referenceType,reference);
        }        if (!referenceType.isSubtypeOf(hierarchicalReferencesId)) {
            return;
        }

        var parent = address_space.findObject(reference.nodeId);
        if (parent) {
            assert( reference.nodeId.toString() !== self.nodeId.toString());

            parent._add_backward_reference({
                referenceType: reference.referenceType,
                isForward:     !reference.isForward,
                nodeId:        self.nodeId
            });
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
            options.value = null;
            options.statusCode = StatusCodes.Bad_AttributeIdInvalid;
            break;
    }
    return new DataValue(options);
};

/**
 * @method writeAttribute
 * @param attributeId {AttributeId}
 * @param dataValue {DataValue}
 * @returns {StatusCodes}
 */
BaseNode.prototype.writeAttibute = function(attributeId,dataValue) {
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
 * @param relativePath.targetName {QualifiedName}
 * @param relativePath.targetName.name {String}
 * @param relativePath.targetName.namespaceIndex {UInt32}
 * @param relativePath.referenceTypeId {NodeId}
 * @param relativePath.isInverse {Boolean}
 * @param relativePath.includeSubtypes {Boolean}
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

//xx    console.log("reference.referenceType",reference.referenceType.yellow.bold);

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
    assert(data.referenceTypeId instanceof NodeId);
    var result =  new browse_service.ReferenceDescription(data);
    assert(result.referenceTypeId instanceof NodeId);

    return result;
};

function referenceTypeToString(address_space,referenceTypeId) {

    if (referenceTypeId ) {
        var referenceType = address_space.findObject(referenceTypeId);
        return referenceTypeId.toString() +" " + referenceType.browseName + '/' + referenceType.inverseName.text;
    } else {
        return "<null> " + referenceTypeId;
    }
}

function nodeIdInfo(address_space,nodeId) {

    var obj = address_space.findObject(nodeId);
    var name = obj ? obj.browseName : " <????>";
    return nodeId.toString() + " [ " + name + " ]";

}
function dumpReferenceDescription(address_space,referenceDescription) {

    assert(address_space);
    assert(referenceDescription.referenceTypeId); // must be known;

    console.log("referenceDescription".red);
    console.log("    referenceTypeId : ", referenceTypeToString(address_space,referenceDescription.referenceTypeId));
    console.log("    isForward       : ",referenceDescription.isForward ? "true" : "false");
    console.log("    nodeId          : ",nodeIdInfo(address_space,referenceDescription.nodeId) );
    console.log("    browseName      : ",referenceDescription.browseName);
    console.log("    nodeClass       : ",referenceDescription.nodeClass.toString());
    console.log("    typeDefinition  : ",nodeIdInfo(address_space,referenceDescription.typeDefinition));

}
function dumpReferenceDescriptions(address_space,referenceDescriptions) {
    assert(address_space);
    referenceDescriptions.forEach(function(r){ dumpReferenceDescription(address_space,r);})
}

function nodeid_is_nothing(nodeid) {
    return ( nodeid.value === 0 && nodeid.namespace === 0);
}

/**
 * @method normalize_referenceTypeId
 * @param address_space {AddressSpace}
 * @param referenceTypeId {String|NodeId|null} : the referenceType either as a string or a nodeId
 * @returns {NodeId}
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
    try {
        var nodeId =  address_space.resolveNodeId(referenceTypeId);
    }
    catch(err) {
        console.log("cannot normalize_referenceTypeId",referenceTypeId );
        throw err;
    }
    assert(nodeId);
    return nodeId;
}


function dumpBrowseDescription(node,browseDescription) {

    var address_space = node.__address_space;

    console.log(" Browse Node :");
    if (browseDescription.nodeId) {
        console.log(" nodeId : ",browseDescription.nodeId.toString().cyan);

    }
    console.log(" nodeId : ",node.browseName.toString().cyan , "(" , node.nodeId.toString(), ")");
    console.log("   referenceTypeId :",referenceTypeToString(address_space,browseDescription.referenceTypeId));

    console.log("   browseDirection :",browseDescription.browseDirection.toString().cyan);
    console.log("   includeSubType  :",browseDescription.includeSubtypes ? "true" : "false");
    console.log("   nodeClassMask   :",browseDescription.nodeClassMask );
    console.log("   resultMask      :",browseDescription.resultMask );
}

/**
 * @method dumpReferences
 * @param baseNode    {BaseNode}
 * @param references  {Array<Reference>||null}
 * @static
 */
function dumpReferences(baseNode,references) {

    assert(baseNode);
    references = references  || baseNode.references;

    var address_space = baseNode.__address_space;

    references.forEach(function(reference){

        var ref = address_space.findObject(reference.referenceType);
        if (!ref) {
            // unknown type ... this may happen when the address space is not fully build
            return ;
        }
        var dir = reference.isForward ? "(=>)" : "(<-)";
        var objectName = nodeIdInfo(address_space,reference.nodeId);

        console.log(" referenceType : " , dir , ref ? ref.browseName : reference.referenceType.toString() , " ",objectName);
    });
}

BaseNode.dumpReferences = dumpReferences;

/**
 * browse the node to extract information requested in browseDescription
 * @method browseNode
 * @param browseDescription {BrowseDescription}
 * @return {ReferenceDescription[]}
 */
BaseNode.prototype.browseNode = function(browseDescription) {

    var do_debug = false;

    do_debug = ( this.browseName === "Server" );

    var self = this;

    if (do_debug) {
        dumpBrowseDescription(self,browseDescription);
        console.log("references :");
        dumpReferences(self,self.references);
    }

    var references;
    var referenceTypeId = normalize_referenceTypeId(this.__address_space,browseDescription.referenceTypeId);
    assert(referenceTypeId instanceof NodeId);

    var browseDirection = browseDescription.browseDirection || BrowseDirection.Both;

    var address_space = self.__address_space;

    // get all possible references
    references = self.references.concat(self.back_references);

    if (do_debug) {
        console.log("all references :");
        dumpReferences(self,self.references);
        console.log("-------------- back")
        dumpReferences(self,self.back_references);
    }

    // make sure we have a valid referenceTypeId if not null
    if (!nodeid_is_nothing(referenceTypeId)) {
        assert (referenceTypeId instanceof NodeId);
        var referenceType = self.__address_space.findObject(referenceTypeId);
        dumpIf(!referenceType,referenceTypeId);
        assert(referenceType instanceof ReferenceType);

        references = references.filter(function(reference){

            // xxx if (reference.referenceType === "HasSubtype"){ return false;  }

            var ref = self.__address_space.findObject(reference.referenceType);
            if (!ref) return false; // unknown type ... this may happen when the address space is not fully build
            dumpIf(!ref,reference);
            assert(ref instanceof ReferenceType);

            var is_of_type = ref.nodeId.toString() === referenceType.nodeId.toString();
            if (browseDescription.includeSubtypes) {
                return ref.isSubtypeOf(referenceType) || is_of_type;
            } else {
                return is_of_type;
            }
        });
    }

    function forwardOnly(reference){ return reference.isForward;}

    function reverseOnly(reference){ return !reference.isForward;}


    var f = [];
    if (browseDirection === BrowseDirection.Forward || browseDirection === BrowseDirection.Both) {
        f = references.filter(forwardOnly).map(function (reference) {
            return _makeReferenceDescription(address_space,reference, true);
        });
        //xx console.log(" filtering Forward references ", references.length,f.length);
    }
    var b = [];
    if (browseDirection === BrowseDirection.Inverse || browseDirection === BrowseDirection.Both) {
        b = references.filter(reverseOnly).map(function (reference) {
            return _makeReferenceDescription(address_space,reference, false);
        });
        //xx console.log(" filtering Backward references ", b.length);
    }
    var referenceDescriptions = f.concat(b);

    if (do_debug) {
        console.log("referenceDescriptions :");
        dumpReferenceDescriptions(self.__address_space, referenceDescriptions);
    }

    return referenceDescriptions;
};

exports.BaseNode = BaseNode;
var ReferenceType= require("./referenceType").ReferenceType;