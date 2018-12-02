"use strict";
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const chalk =require("chalk");

const NodeClass = require("node-opcua-data-model").NodeClass;
const QualifiedName = require("node-opcua-data-model").QualifiedName;
const NodeId = require("node-opcua-nodeid").NodeId;

const BaseNode = require("./base_node").BaseNode;
const ReferenceType = require("./referenceType").ReferenceType;
const UAVariable = require("./ua_variable").UAVariable;
const UAVariableType = require("./ua_variable_type").UAVariableType;
const UAObjectType = require("./ua_object_type").UAObjectType;
const UAObject = require("./ua_object").UAObject;
const UAMethod = require("./ua_method").UAMethod;
const UADataType = require("./ua_data_type").UADataType;
const Reference = require("./reference").Reference;
const View = require("./view").View;

const utils = require("node-opcua-utils");
const dumpIf = require("node-opcua-debug").dumpIf;

const BrowseDirection = require("node-opcua-data-model").BrowseDirection;

const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

const doDebug = false;


const regExp1 = /^(s|i|b|g)=/;
const regExpNamespaceDotBrowseName  = /^[0-9]+:(.*)/;


/**
 *
 * @constructor
 * @params options {Object}
 * @params options.namespaceUri {string}
 * @params options.addressSpace {AddressSpace}
 * @params options.index {number}
 * @params options.version="" {string}
 * @params options.publicationDate="" {Date}
 *
 */
function UANamespace(options) {

    const self = this;
    assert(typeof options.namespaceUri === "string");
    assert(options.addressSpace.constructor.name === "AddressSpace");
    assert(typeof options.index === "number");

    self.namespaceUri = options.namespaceUri;
    self.addressSpace = options.addressSpace;
    self.index = options.index;
    self._nodeid_index = {};
    self._internal_id_counter = 1000;

    self._aliases = {};
    self._objectTypeMap = {};
    self._variableTypeMap = {};
    self._referenceTypeMap = {};
    self._referenceTypeMapInv = {};
    self._dataTypeMap = {};
}

UANamespace.prototype.getDefaultNamespace = function () {
    return (this.index === 0) ? this : this.addressSpace.getDefaultNamespace();
};

UANamespace.prototype.dispose = function () {
    const self = this;

    _.forEach(self._nodeid_index, function (node) {
        node.dispose();
    });
    self._nodeid_index = null;
    self.addressSpace = null;

    self._aliases = null;

    self._objectTypeMap = null;
    self._variableTypeMap = null;
    self._referenceTypeMap = null;
    self._referenceTypeMapInv = null;
    self._dataTypeMap = null;

};


UANamespace.prototype._build_new_NodeId = function () {
    let nodeId;
    do {
        nodeId = makeNodeId(this._internal_id_counter, this.index);
        this._internal_id_counter += 1;
    } while (this._nodeid_index.hasOwnProperty(nodeId));
    return nodeId;
};

UANamespace.prototype.findNode = function (nodeId) {
    if (typeof nodeId === "string") {
        if (nodeId.match(regExp1)) {
            nodeId = "ns=" + this.index+";"+ nodeId;
        }
    }
    nodeId = resolveNodeId(nodeId);
    assert(nodeId.namespace === this.index);
    return this._nodeid_index[nodeId.toString()];
};


function _adjust_options(self, options) {
    const ns = self.addressSpace.getNamespaceIndex(self.namespaceUri);
    if (!options.nodeId) {
        const id = self._getNextAvailableId();
        options.nodeId = new NodeId(NodeId.NodeIdType.NUMERIC, id, ns);
    }
    options.nodeId = NodeId.coerce(options.nodeId);
    if (typeof options.browseName === "string") {
        options.browseName = new QualifiedName({
            name: options.browseName,
            namespaceIndex: ns
        });
    }
    return options;
}


/**
 *
 * @param objectType {String}
 * @return {UAObjectType|null}
 */
UANamespace.prototype.findObjectType = function (objectType) {
    assert(typeof objectType === "string");
    return this._objectTypeMap[objectType];
};
/**
 *
 * @param variableType {String}
 * @returns {UAVariableType|null}
 */
UANamespace.prototype.findVariableType = function (variableType) {
    assert(typeof variableType === "string");
    return this._variableTypeMap[variableType];
};
/**
 *
 * @param dataType {String}
 * @returns {UADataType|null}
 */
UANamespace.prototype.findDataType = function (dataType) {
    assert(typeof dataType === "string");
    assert(this._dataTypeMap,"internal error : _dataTypeMap is missing");
    return this._dataTypeMap[dataType];
};
/**
 *
 * @param referenceType {String}
 * @returns  {ReferenceType|null}
 */
UANamespace.prototype.findReferenceType = function (referenceType) {
    assert(typeof referenceType === "string");
    return this._referenceTypeMap[referenceType];
};
/**
 * find a ReferenceType by its inverse name.
 * @method findReferenceTypeFromInverseName
 * @param inverseName {String} the inverse name of the ReferenceType to find
 * @return {ReferenceType}
 */
UANamespace.prototype.findReferenceTypeFromInverseName = function (inverseName) {
    assert(typeof inverseName === "string");
    const node = this._referenceTypeMapInv[inverseName];
    assert(!node || (node.nodeClass === NodeClass.ReferenceType && node.inverseName.text === inverseName));
    return node;
};

function _registerObjectType(self, node) {
    assert(self.index === node.nodeId.namespace);
    const key = node.browseName.name;
    assert(!self._objectTypeMap[key], " UAObjectType already declared");
    self._objectTypeMap[key] = node;
}

function _registerVariableType(self, node) {
    assert(self.index === node.nodeId.namespace);
    const key = node.browseName.name;
    assert(!self._variableTypeMap[key], " UAVariableType already declared");
    self._variableTypeMap[key] = node;
}

function _registerReferenceType(self, node) {
    assert(self.index === node.nodeId.namespace);
    assert(node.browseName instanceof QualifiedName);
    if (!node.inverseName) {
        // Inverse name is not required anymore in 1.0.4
        //xx console.log("Warning : node has no inverse Name ", node.nodeId.toString(), node.browseName.toString());
        node.inverseName = {text: node.browseName.name};
    }
    const key = node.browseName.name;
    assert(key);
    assert(node.inverseName.text);
    assert(!self._referenceTypeMap[key], " Node already declared");
    assert(!self._referenceTypeMapInv[node.inverseName], " Node already declared");
    self._referenceTypeMap[key] = node;
    self._referenceTypeMapInv[node.inverseName.text] = node;
}

function _registerDataType(self, node) {
    assert(self.index === node.nodeId.namespace);
    const key = node.browseName.name;
    assert(node.browseName instanceof QualifiedName);
    assert(!self._dataTypeMap[key], " DataType already declared");
    self._dataTypeMap[key] = node;
}

UANamespace.prototype._register = function (node) {
    assert(node instanceof BaseNode, "Expecting a instance of BaseNode in _register");
    assert(node.nodeId instanceof NodeId, "Expecting a NodeId");
    if (node.nodeId.namespace !== this.index) {
        throw new Error("node must belongs to this namespace");
    }
    assert(node.nodeId.namespace === this.index && "node must belongs to this namespace");
    assert(node.hasOwnProperty("browseName"), "Node must have a browseName");
    //assert(node.browseName.namespaceIndex === this.index,"browseName must belongs to this namespace");

    const indexName = node.nodeId.toString();
    if (this._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("nodeId " + node.nodeId.displayText() + " already registered " + node.nodeId.toString());
    }

    this._nodeid_index[indexName] = node;

    if (node.nodeClass === NodeClass.ObjectType) {
        _registerObjectType(this, node);
    } else if (node.nodeClass === NodeClass.VariableType) {
        _registerVariableType(this, node);
    } else if (node.nodeClass === NodeClass.ReferenceType) {
        _registerReferenceType(this, node);
    } else if (node.nodeClass === NodeClass.DataType) {
        _registerDataType(this, node);
    } else if (node.nodeClass === NodeClass.Object) {
    } else if (node.nodeClass === NodeClass.Variable) {
    } else if (node.nodeClass === NodeClass.Method) {
    } else if (node.nodeClass === NodeClass.View) {
    } else {
        console.log("Invalid class Name", node.nodeClass);
        throw new Error("Invalid class name specified");
    }
};


function _unregisterObjectType() {
}

UANamespace.prototype._deleteNode = function (node) {

    const self = this;
    assert(node instanceof BaseNode);

    const indexName = node.nodeId.toString();
    // istanbul ignore next
    if (!self._nodeid_index.hasOwnProperty(indexName)) {
        throw new Error("deleteNode : nodeId " + node.nodeId.displayText() + " is not registered " + node.nodeId.toString());
    }
    if (node.nodeClass === NodeClass.ObjectType) {
        _unregisterObjectType(self, node);
    } else if (node.nodeClass === NodeClass.Object) {
    } else if (node.nodeClass === NodeClass.Variable) {
    } else if (node.nodeClass === NodeClass.Method) {
    } else if (node.nodeClass === NodeClass.View) {
    } else {
        console.log("Invalid class Name", node.nodeClass);
        throw new Error("Invalid class name specified");
    }
    assert(self._nodeid_index[indexName] === node);
    delete self._nodeid_index[indexName];

    node.dispose();
};
/**
 *
 * @method addAlias
 * @param alias_name {String} the alias name
 * @param nodeId {NodeId} NodeId must belong to this namespace
 */
UANamespace.prototype.addAlias = function (alias_name, nodeId) {
    assert(typeof alias_name === "string");
    assert(nodeId instanceof NodeId);
    assert(nodeId.namespace === this.index);
    this._aliases[alias_name] = nodeId;
};


const hasPropertyRefId = resolveNodeId("HasProperty");
const hasComponentRefId = resolveNodeId("HasComponent");
const sameNodeId = require("node-opcua-nodeid").sameNodeId;

function _identifyParentInReference(references) {
    assert(_.isArray(references));
    const candidates = references.filter(function (ref) {
        return ref.isForward === false &&
            (sameNodeId(ref.referenceType, hasComponentRefId) || sameNodeId(ref.referenceType, hasPropertyRefId));
    });
    assert(candidates.length <= 1);
    return candidates[0];
}

UANamespace.nodeIdNameSeparator = "-";

const _constructors_map = {
    "Object": UAObject,
    "ObjectType": UAObjectType,
    "ReferenceType": ReferenceType,
    "Variable": UAVariable,
    "VariableType": UAVariableType,
    "DataType": UADataType,
    "Method": UAMethod,
    "View": View
};

function __combineNodeId(parentNodeId, name) {
    let nodeId = null;
    if (parentNodeId.identifierType === NodeId.NodeIdType.STRING) {
        const childName = parentNodeId.value + UANamespace.nodeIdNameSeparator + name.toString();
        nodeId = new NodeId(NodeId.NodeIdType.STRING, childName, parentNodeId.namespace);
    }
    return nodeId;
}

UANamespace.prototype._construct_nodeId = function (options) {

    const self = this;
    const addressSpace = self.addressSpace;
    let nodeId = options.nodeId;

    if (!nodeId) {

        for (const ref of options.references) {
            ref._referenceType = addressSpace.findReferenceType(ref.referenceType);
            ref.referenceType = ref._referenceType.nodeId;
        }
        // find HasComponent, or has Property reverse
        const parentRef = _identifyParentInReference(options.references);
        if (parentRef) {
            assert(parentRef.nodeId instanceof NodeId);
            assert(options.browseName instanceof QualifiedName);
            nodeId = __combineNodeId(parentRef.nodeId, options.browseName);
        }
    } else if (typeof nodeId === "string") {
        if (nodeId.match(regExp1)) {
            nodeId = "ns="+ self.index + ";" + nodeId;
        }
    }
    nodeId = nodeId || self._build_new_NodeId();
    if (nodeId instanceof NodeId) {
        return nodeId;
    }
    nodeId = resolveNodeId(nodeId);
    assert(nodeId instanceof NodeId);
    return nodeId;
};

/**
 * @method _createNode
 * @private
 * @param options
 *
 * @param [options.nodeId==null]      {NodeId}
 * @param options.nodeClass  {NodeClass}
 * @param options.browseName {String|QualifiedName} the node browseName
 *    the browseName can be either a string : "Hello"
 *                                 a string with a namespace : "1:Hello"
 *                                 a QualifiedName : new QualifiedName({name:"Hello", namespaceIndex:1});
 * @return {BaseNode}
 * @private
 */
UANamespace.prototype._createNode = function (options) {

    const self = this;

    assert(options.nodeClass !== undefined, " options.nodeClass must be specified");
    assert(options.browseName, "options.browseName must be specified");
    //xx assert(options.browseName instanceof QualifiedName ? (options.browseName.namespaceIndex === self.index): true,"Expecting browseName to have the same namepsaceIndex as the namespace");


    options.description = coerceLocalizedText(options.description);


    // browseName adjustment
    if (typeof options.browseName === "string") {

        const match = options.browseName.match(regExpNamespaceDotBrowseName);
        if (match) {
            const correctedName= match[1];
            // the application is using an old scheme
            console.log(chalk.green("Warning : since node-opcua 0.4.2 , namespace should not be prepended to the browse name anymore"));
            console.log("   ", options.browseName, " will be replaced with " , correctedName);
            console.log(" Please update your code");

            const indexVerif = parseInt(match[0]);
            if (indexVerif !== self.index) {
                console.log(chalk.red.bold("Error: namespace index used at the front of the browseName " + indexVerif + " do not match the index of the current namespace ("+ self.index+ ")"));
                console.log(" Please fix your code so that the created node is inserted in the correct namespace, please refer to the NodeOPCUA documentation");
            }
        }

        options.browseName = new QualifiedName({name: options.browseName, namespaceIndex: self.index});

    } else if (!(options.browseName instanceof QualifiedName)) {
        options.browseName = new QualifiedName(options.browseName);
    }
    assert(options.browseName instanceof QualifiedName, "Expecting options.browseName to be instanceof  QualifiedName ");


    //--- nodeId adjustment
    options.nodeId = self._construct_nodeId(options);
    dumpIf(!options.nodeId, options); // missing node Id
    assert(options.nodeId instanceof NodeId);

    //assert(options.browseName.namespaceIndex === self.index,"Expecting browseName to have the same namepsaceIndex as the namespace");

    const Constructor = _constructors_map[NodeClass[options.nodeClass]];

    if (!Constructor) {
        throw new Error(" missing constructor for NodeClass " + NodeClass[options.nodeClass]);
    }

    options.addressSpace = self.addressSpace;
    const node = new Constructor(options);

    assert(node.nodeId);
    assert(node.nodeId instanceof NodeId);
    this._register(node);

    // object shall now be registered
    if (doDebug) {
        assert(_.isObject(this.findNode(node.nodeId)));
    }
    return node;
};


/**
 * @method _addVariable
 * @private
 */
UANamespace.prototype._addVariable = function (options) {

    const self = this;

    const addressSpace = self.addressSpace;
    const baseDataVariableTypeId = addressSpace.findVariableType("BaseDataVariableType").nodeId;

    assert(options.hasOwnProperty("browseName"), "options.browseName must be provided");
    assert(options.hasOwnProperty("dataType"), "options.dataType must be provided");

    options.historizing = !!options.historizing;

    // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?

    // istanbul ignore next
    if (options.hasOwnProperty("hasTypeDefinition")) {
        throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
    }
    // ------------------------------------------ TypeDefinition
    let typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    typeDefinition = addressSpace._coerce_VariableTypeIds(typeDefinition);
    assert(typeDefinition instanceof NodeId);

    // ------------------------------------------ DataType
    options.dataType = addressSpace._coerce_DataType(options.dataType);

    options.valueRank = utils.isNullOrUndefined(options.valueRank) ? -1 : options.valueRank;
    assert(_.isFinite(options.valueRank));
    assert(typeof options.valueRank === "number");

    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions) || options.arrayDimensions === null);
    // -----------------------------------------------------


    options.minimumSamplingInterval = +options.minimumSamplingInterval || 0;
    let references = options.references || [];

    references = [].concat(references, [
        {referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition}
    ]);

    assert(!options.nodeClass || options.nodeClass === NodeClass.Variable);
    options.nodeClass = NodeClass.Variable;

    options.references = references;

    const variable = self.createNode(options);
    assert(variable instanceof UAVariable);
    return variable;
};

/**
 * add a variable as a component of the parent node
 *
 * @method addVariable
 * @param options
 * @param options.browseName {String} the variable name
 * @param options.dataType   {String} the variable datatype ( "Double", "UInt8" etc...)
 * @param [options.typeDefinition="BaseDataVariableType"]
 * @param [options.modellingRule=null] the Modelling rule : "Optional" , "Mandatory"
 * @param [options.valueRank= -1]   {Int} the valueRank
 * @param [options.arrayDimensions] {null| Array<Int>}
 * @return {Object}*
 */
UANamespace.prototype.addVariable = function (options) {

    const self = this;
    assert(arguments.length === 1, "Invalid arguments AddressSpace#addVariable now takes only one argument.");
    if (options.hasOwnProperty("propertyOf") && options.propertyOf) {
        assert(!options.typeDefinition || options.typeDefinition === "PropertyType");
        options.typeDefinition = options.typeDefinition || "PropertyType";

    } else {
        assert(!options.typeDefinition || options.typeDefinition !== "PropertyType");
    }
    return self._addVariable(options);
};


UANamespace.prototype._addObjectOrVariableType = function (options, topMostBaseType, nodeClass) {

    const self = this;
    const addressSpace = self.addressSpace;

    assert(typeof topMostBaseType === "string");
    assert(nodeClass === NodeClass.ObjectType || nodeClass === NodeClass.VariableType);

    assert(!options.nodeClass);
    assert(options.browseName);
    assert(typeof options.browseName === "string");
    if (options.hasOwnProperty("references")) {
        throw new Error("options.references should not be provided, use options.subtypeOf instead");
    }
    const references = [];

    function process_subtypeOf_options(self, options, references) {

        // check common misspelling mistake
        assert(!options.subTypeOf, "misspell error : it should be 'subtypeOf' instead");
        if (options.hasOwnProperty("hasTypeDefinition")) {
            throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
        }
        assert(!options.typeDefinition, " do you mean subtypeOf ?");

        const subtypeOfNodeId = addressSpace._coerceType(options.subtypeOf, topMostBaseType, nodeClass);

        assert(subtypeOfNodeId);
        references.push({referenceType: "HasSubtype", isForward: false, nodeId: subtypeOfNodeId});

    }

    process_subtypeOf_options(self, options, references);

    const objectType = this._createNode({
        browseName: options.browseName,
        displayName:   options.displayName || options.browseName,
        nodeClass: nodeClass,
        isAbstract: !!options.isAbstract,
        eventNotifier: +options.eventNotifier,
        references: references,
        nodeId: options.nodeId
    });

    objectType.propagate_back_references();

    objectType.install_extra_properties();

    objectType.installPostInstallFunc(options.postInstantiateFunc);

    return objectType;

};


/**
 * add a new Object type to the address space
 * @method addObjectType
 * @param options
 * @param options.browseName {String} the object type name
 * @param [options.displayName] {String|LocalizedText} the display name
 * @param [options.subtypeOf="BaseObjectType"] {String|NodeId|BaseNode} the base class
 * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
 * @param [options.isAbstract = false] {Boolean}
 * @param [options.eventNotifier = 0] {Integer}
 * @param [options.postInstantiateFunc = null] {Function}
 *
 */
UANamespace.prototype.addObjectType = function (options) {
    const self = this;
    assert(!options.hasOwnProperty("dataType"), "an objectType should not have a dataType");
    assert(!options.hasOwnProperty("valueRank"), "an objectType should not have a valueRank");
    assert(!options.hasOwnProperty("arrayDimensions"), "an objectType should not have a arrayDimensions");
    return self._addObjectOrVariableType(options, "BaseObjectType", NodeClass.ObjectType);
};


/**
 * add a new Variable type to the address space
 * @method addVariableType
 * @param options
 * @param options.browseName {String} the object type name
 * @param [options.displayName] {String|LocalizedText} the display name
 * @param [options.subtypeOf="BaseVariableType"] {String|NodeId|BaseNode} the base class
 * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType, if not provided a new nodeId will be created
 * @param [options.isAbstract = false] {Boolean}
 * @param options.dataType {String|NodeId} the variable DataType
 * @param [options.valueRank = -1]
 * @param [options.arrayDimensions = null] { Array<Int>>
 *
 */

UANamespace.prototype.addVariableType = function (options) {

    const self = this;
    assert(!options.hasOwnProperty("arrayDimension"), "Do you mean ArrayDimensions ?");

    // dataType
    options.dataType = options.dataType || "Int32";
    options.dataType = self.addressSpace._coerce_DataType(options.dataType);

    // valueRank
    options.valueRank = utils.isNullOrUndefined(options.valueRank) ? -1 : options.valueRank;
    assert(_.isFinite(options.valueRank));
    assert(typeof options.valueRank === "number");

    // arrayDimensions
    options.arrayDimensions = options.arrayDimensions || null;
    assert(_.isArray(options.arrayDimensions) || options.arrayDimensions === null);

    const variableType = self._addObjectOrVariableType(options, "BaseVariableType", NodeClass.VariableType);

    variableType.dataType = options.dataType;
    variableType.valueRank = options.valueRank;
    variableType.arrayDimensions = options.arrayDimensions;

    return variableType;
};


UANamespace.prototype.addView = function (options) {

    const self = this;
    assert(arguments.length === 1, "Namespace#addView expecting a single argument");
    assert(options);
    assert(options.hasOwnProperty("browseName"));
    assert(options.hasOwnProperty("organizedBy"));
    const browseName = options.browseName;
    assert(typeof browseName === "string");

    const addressSpace = self.addressSpace;
    const baseDataVariableTypeId = addressSpace.findVariableType("BaseDataVariableType").nodeId;

    // ------------------------------------------ TypeDefinition
    const typeDefinition = options.typeDefinition || baseDataVariableTypeId;
    options.references = options.references || [];

    options.references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition});

    // xx assert(self.FolderTypeId && self.BaseObjectTypeId); // is default address space generated.?

    assert(!options.nodeClass);
    options.nodeClass = NodeClass.View;

    const view = self.createNode(options);
    assert(view instanceof View);
    assert(view.nodeId instanceof NodeId);
    assert(view.nodeClass === NodeClass.View);
    return view;
};


UANamespace.prototype.addObject = function (options) {

    assert(!options.nodeClass || options.nodeClass === NodeClass.Object);
    options.nodeClass = NodeClass.Object;

    const typeDefinition = options.typeDefinition || "BaseObjectType";
    options.references = options.references || [];
    options.references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition});
    options.eventNotifier = +options.eventNotifier;
    const obj = this.createNode(options);
    assert(obj instanceof UAObject);
    assert(obj.nodeClass === NodeClass.Object);
    return obj;
};


/**
 *
 * @method addFolder
 * @param parentFolder
 * @param options {String|Object}
 * @param options.browseName {String} the name of the folder
 * @param [options.nodeId] {NodeId}. An optional nodeId for this object
 *
 * @return {BaseNode}
 */
UANamespace.prototype.addFolder = function (parentFolder, options) {
    const self = this;
    if (typeof options === "string") {
        options = {browseName: options};
    }

    const addressSpace = self.addressSpace;

    assert(!options.typeDefinition, "addFolder does not expect typeDefinition to be defined ");
    const typeDefinition = addressSpace._coerceTypeDefinition("FolderType");
    parentFolder = addressSpace._coerceFolder(parentFolder);
    options.nodeClass = NodeClass.Object;
    options.references = [
        {referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition},
        {referenceType: "Organizes", isForward: false, nodeId: parentFolder.nodeId}
    ];
    const node = self.createNode(options);
    return node;
};

/**
 * @method addReferenceType
 * @param options
 * @param options.isAbstract
 * @param options.browseName
 * @param options.inverseName
 */
UANamespace.prototype.addReferenceType = function (options) {

    const namespace = this;
    const addressSpace = namespace.addressSpace;

    options.nodeClass = NodeClass.ReferenceType;
    options.references = options.references || [];


    if (options.subtypeOf) {
        assert(options.subtypeOf);
        const subtypeOfNodeId = addressSpace._coerceType(options.subtypeOf, "References", NodeClass.ReferenceType);
        assert(subtypeOfNodeId);

        console.log(subtypeOfNodeId.toString().cyan);
        options.references.push({referenceType: "HasSubtype", isForward: false, nodeId: subtypeOfNodeId});
    }
    const node = namespace._createNode(options);

    node.propagate_back_references();

    return node;
};

/**
 * @method createDataType
 * @param options
 * @param options.isAbstract
 * @param options.browseName {BrowseName}
 * @param options.superType {NodeId}
 * @param [options.nodeId]
 * @param [options.displayName]
 * @param [options.description]
 *
 */
UANamespace.prototype.createDataType = function (options) {
    assert(!options.hasOwnProperty("addressSpace"));
    assert(options.hasOwnProperty("isAbstract"));
    assert(!options.hasOwnProperty("nodeClass"));
    assert(options.hasOwnProperty("browseName"), "must provide a browseName");
    const self = this;
    options.nodeClass = NodeClass.DataType;
    options.references = options.references || [];

    if (options.references.length === 0) {
        assert(options.hasOwnProperty("superType"), "must provide a superType");

        options.superType = this.addressSpace.findDataType(options.superType);
        assert(options.superType);
        options.references.push({
            referenceType: "HasSubtype", isForward: false, nodeId: options.superType.nodeId
        });
    }
    const node = self._createNode(options);
    return node;
};


/**
 * @method _coerce_parent
 * convert a 'string' , NodeId or Object into a valid and existing object
 * @param addressSpace  {AddressSpace}
 * @param value
 * @param coerceFunc {Function}
 * @private
 */
function _coerce_parent(addressSpace, value, coerceFunc) {
    assert(_.isFunction(coerceFunc));
    if (value) {
        if (typeof value === "string") {
            value = coerceFunc.call(addressSpace, value);
        }
        if (value instanceof NodeId) {
            value = addressSpace.findNode(value);
        }
    }
    assert(!value || value instanceof BaseNode);
    return value;
}

function _handle_event_hierarchy_parent(addressSpace, references, options) {

    options.eventSourceOf = _coerce_parent(addressSpace, options.eventSourceOf, addressSpace._coerceNode);
    options.notifierOf = _coerce_parent(addressSpace, options.notifierOf, addressSpace._coerceNode);
    if (options.eventSourceOf) {
        assert(!options.notifierOf, "notifierOf shall not be provided with eventSourceOf ");
        references.push({referenceType: "HasEventSource", isForward: false, nodeId: options.eventSourceOf.nodeId});

    } else if (options.notifierOf) {
        assert(!options.eventSourceOf, "eventSourceOf shall not be provided with notifierOf ");
        references.push({referenceType: "HasNotifier", isForward: false, nodeId: options.notifierOf.nodeId});
    }
}

function _handle_hierarchy_parent(addressSpace, references, options) {

    options.componentOf = _coerce_parent(addressSpace, options.componentOf, addressSpace._coerceNode);
    options.propertyOf = _coerce_parent(addressSpace, options.propertyOf, addressSpace._coerceNode);
    options.organizedBy = _coerce_parent(addressSpace, options.organizedBy, addressSpace._coerceFolder);

    if (options.componentOf) {
        assert(!options.propertyOf);
        assert(!options.organizedBy);
        assert(addressSpace.rootFolder.objects, "addressSpace must have a rootFolder.objects folder");
        assert(options.componentOf.nodeId !== addressSpace.rootFolder.objects.nodeId, "Only Organizes References are used to relate Objects to the 'Objects' standard Object.");
        references.push({referenceType: "HasComponent", isForward: false, nodeId: options.componentOf.nodeId});
    }

    if (options.propertyOf) {
        assert(!options.componentOf);
        assert(!options.organizedBy);
        assert(options.propertyOf.nodeId !== addressSpace.rootFolder.objects.nodeId, "Only Organizes References are used to relate Objects to the 'Objects' standard Object.");
        references.push({referenceType: "HasProperty", isForward: false, nodeId: options.propertyOf.nodeId});
    }

    if (options.organizedBy) {
        assert(!options.propertyOf);
        assert(!options.componentOf);
        references.push({referenceType: "Organizes", isForward: false, nodeId: options.organizedBy.nodeId});
    }
}

UANamespace._handle_hierarchy_parent = _handle_hierarchy_parent;

function _copy_reference(reference) {
    assert(reference.hasOwnProperty("referenceType"));
    assert(reference.hasOwnProperty("isForward"));
    assert(reference.hasOwnProperty("nodeId"));
    assert(reference.nodeId instanceof NodeId);
    return {
        referenceType: reference.referenceType,
        isForward: reference.isForward,
        nodeId: reference.nodeId
    };
}

function _copy_references(references) {
    references = references || [];
    return references.map(_copy_reference);
}

function isNonEmptyQualifiedName(browseName) {
    if (!browseName) {
        return false;
    }
    if (typeof browseName === "string") {
        return browseName.length >= 0;
    }
    if (!(browseName instanceof QualifiedName)) {
        browseName = new QualifiedName(browseName);
    }
    assert(browseName instanceof QualifiedName);
    return browseName.name.length > 0;
}

UANamespace.isNonEmptyQualifiedName = isNonEmptyQualifiedName;

function _handle_node_version(node, options) {

    assert(options);
    if (options.nodeVersion) {
        assert(node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.Object);

        const nodeVersion = node.addressSpace.getOwnNamespace().addVariable({
            propertyOf: node,
            browseName: "NodeVersion",
            dataType: "String"
        });
        const initialValue = _.isString(options.nodeVersion) ? options.nodeVersion : "0";
        //xx console.log(" init value =",initialValue);
        nodeVersion.setValueFromSource({dataType: "String", value: initialValue});
    }
}

const cetools = require("./address_space_change_event_tools");
const _handle_model_change_event = cetools._handle_model_change_event;


function isValidModellingRule(ruleName) {
    // let restrict to Mandatory or Optional for the time being
    return ruleName === null || ruleName === "Mandatory" || ruleName === "Optional";
}


/**
 * @method _process_modelling_rule
 * @param references {Array<Reference>} the array of references
 * @param modellingRule {Reference} the modellling Rule reference.
 * @private
 */
UANamespace._process_modelling_rule = function (references, modellingRule) {
    if (modellingRule) {
        assert(isValidModellingRule(modellingRule), "expecting a valid modelling rule");
        const modellingRuleName = "ModellingRule_" + modellingRule;
        //assert(self.findNode(modellingRuleName),"Modelling rule must exist");
        references.push({referenceType: "HasModellingRule", nodeId: modellingRuleName});
    }
};


/**
 * @method createNode
 * @param options
 * @param options.nodeClass
 * @param [options.nodeVersion {String} = "0" ] install nodeVersion
 * @param [options.modellingRule {String} = null]
 *
 */
UANamespace.prototype.createNode = function (options) {

    const self = this;

    let node = null;
    const addressSpace = self.addressSpace;

    addressSpace.modelChangeTransaction(function () {

        assert(isNonEmptyQualifiedName(options.browseName));
        //xx assert(options.hasOwnProperty("browseName") && options.browseName.length > 0);

        assert(options.hasOwnProperty("nodeClass"));
        options.references = addressSpace.normalizeReferenceTypes(options.references);

        const references = _copy_references(options.references);

        _handle_hierarchy_parent(addressSpace, references, options);

        _handle_event_hierarchy_parent(addressSpace, references, options);

        UANamespace._process_modelling_rule(references, options.modellingRule);

        options.references = references;

        node = self._createNode(options);
        assert(node.nodeId instanceof NodeId);

        node.propagate_back_references();

        node.install_extra_properties();

        _handle_node_version(node, options);

        _handle_model_change_event(node);

    });
    return node;
};
const _handle_delete_node_model_change_event = cetools._handle_delete_node_model_change_event;

/**
 * remove the specified Node from the address space
 *
 * @method deleteNode
 * @param  nodeOrNodeId
 *
 *
 */
UANamespace.prototype.deleteNode = function (nodeOrNodeId) {

    const self = this;
    let node = null;
    let nodeId;
    if (nodeOrNodeId instanceof NodeId) {
        nodeId = nodeOrNodeId;
        node = this.findNode(nodeId);
        // istanbul ignore next
        if (!node) {
            throw new Error(" deleteNode : cannot find node with nodeId" + nodeId.toString());
        }
    } else if (nodeOrNodeId instanceof BaseNode) {
        node = nodeOrNodeId;
        nodeId = node.nodeId;
    }
    if (nodeId.namespace !== self.index) {
        throw new Error("this node doesn't belong to this namespace");
    }

    const addressSpace = self.addressSpace;

    addressSpace.modelChangeTransaction(function () {

        // notify parent that node is being removed
        const hierarchicalReferences = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse);
        hierarchicalReferences.forEach(function (ref) {
            const parent = addressSpace.findNode(ref.nodeId);
            assert(parent);
            parent._on_child_removed(node);
        });

        function deleteNodePointedByReference(ref) {
            const addressSpace = self;
            const o = addressSpace.findNode(ref.nodeId);
            addressSpace.deleteNode(o.nodeId);
        }

        // recursively delete all nodes below in the hierarchy of nodes
        // TODO : a better idea would be to extract any references of type "HasChild"
        const components = node.findReferences("HasComponent", true);
        const properties = node.findReferences("HasProperty", true);

        // TODO: shall we delete nodes pointed by "Organizes" links here ?
        const subfolders = node.findReferences("Organizes", true);
        const rf = [].concat(components, properties, subfolders);

        rf.forEach(deleteNodePointedByReference);

        _handle_delete_node_model_change_event(node);

        node.unpropagate_back_references();

        // delete nodes from global index
        const namespace = addressSpace.getNamespace(node.nodeId.namespace);
        assert(namespace === self);
        namespace._deleteNode(node);
    });
};

exports.Namespace = UANamespace;

