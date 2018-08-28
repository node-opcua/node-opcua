"use strict";

// produce nodeset xml files
const XMLWriter = require("xml-writer");
const _ = require("underscore");

const UAVariable = require("./ua_variable").UAVariable;
const BaseNode = require("./base_node").BaseNode;
const UADataType = require("./ua_data_type").UADataType;
const UAObject = require("./ua_object").UAObject;
const UAObjectType = require("./ua_object_type").UAObjectType;
const UAMethod = require("./ua_method").UAMethod;
const UAVariableType = require("./ua_variable_type").UAVariableType;
const Reference = require("..").Reference;


const NodeId = require("node-opcua-nodeid").NodeId;
const QualifiedName = require("node-opcua-data-model").QualifiedName;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const BrowseDirection = require("node-opcua-data-model").BrowseDirection;
const assert = require("node-opcua-assert").assert;


const Namespace = require("../src/namespace").Namespace;

Namespace.prototype.getStandardsNodeIds = function(){

    const standardNodeIds= {};
    standardNodeIds.referenceTypeIds = {};
    standardNodeIds.objectTypeIds = {};

    for (let referenceType of _.values(this._referenceTypeMap)) {
        standardNodeIds.referenceTypeIds[referenceType.browseName.name] = referenceType.nodeId.toString();
    }
    for (let objectType of _.values(this._objectTypeMap)) {
        standardNodeIds.objectTypeIds[objectType.browseName.name] = objectType.nodeId.toString();

    }
    return standardNodeIds;
};



function _hash(node) {
    return (node.nodeId.toString());
}
function _dumpDisplayName(xw, node) {
    xw.startElement("DisplayName").text(node.displayName[0].text).endElement();
}

function _dumpDescription(xw, node) {
    if (node.description) {
        let desc = node.description.text;
        desc = desc || "";
        xw.startElement("Description").text(desc).endElement();
    }
}

function translateNodeId(xw,nodeId) {
    assert(nodeId instanceof NodeId);
    const n = xw.translationTable[nodeId.namespace];
    const translatedNode = new NodeId(nodeId.identifierType,nodeId.value,n);
    return translatedNode;
}
function n(xw,nodeId) {
    return translateNodeId(xw,nodeId).toString().replace("ns=0;","");
}
function translateBrowseName(xw,browseName) {
    assert(browseName instanceof QualifiedName);
    const n = xw.translationTable[browseName.namespaceIndex];
    const translatedBrowseName = new QualifiedName({namespaceIndex: n,name: browseName.name });
    return translatedBrowseName;
}
function b(xw,nodeId) {
    return translateBrowseName(xw,nodeId).toString().replace("ns=0;","");
}

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

function _dumpReferences(xw, node) {

    xw.startElement("References");

    const addressSpace = node.addressSpace;

    const aggregateReferenceType = addressSpace.findReferenceType("Aggregates");
    const hasChildReferenceType = addressSpace.findReferenceType("HasChild");
    const hasSubtypeReferenceType= addressSpace.findReferenceType("HasSubtype");
    const hasTypeDefinitionReferenceType = addressSpace.findReferenceType("HasTypeDefinition");
    const nonHierarchicalReferencesType = addressSpace.findReferenceType("NonHierarchicalReferences");
    const organizesReferencesType = addressSpace.findReferenceType("Organizes");
    const connectsToReferenceType = addressSpace.findReferenceType("ConnectsTo");
    const hasEventSourceReferenceType = addressSpace.findReferenceType("HasEventSource");

    function referenceToKeep(reference) {
        const referenceType = reference._referenceType;

        // only keep
        if (referenceType.isSupertypeOf(aggregateReferenceType) && reference.isForward)
            return true;

        else if (referenceType.isSupertypeOf(hasSubtypeReferenceType) && !reference.isForward)
            return true;
        else if (referenceType.isSupertypeOf(hasTypeDefinitionReferenceType) && reference.isForward)
            return true;
        else if (referenceType.isSupertypeOf(nonHierarchicalReferencesType) && reference.isForward)
            return true;
        else if (referenceType.isSupertypeOf(organizesReferencesType) && !reference.isForward)
            return true;
        else if (connectsToReferenceType && referenceType.isSupertypeOf(connectsToReferenceType) && reference.isForward)
            return true;
        else if (referenceType.isSupertypeOf(hasEventSourceReferenceType) && reference.isForward)
            return true;
        return false;
    }
    const references = _.map(node.allReferences()).filter(referenceToKeep);

    for (let reference of references) {

        if (reference._referenceType.browseName.toString() === "HasSubtype" &&reference.isForward)
            continue;

        // only output inverse Reference
        xw.startElement("Reference");

        xw.writeAttribute("ReferenceType", b(xw,reference._referenceType.browseName));

        if (!reference.isForward) {
           xw.writeAttribute("IsForward", reference.isForward ? "true" : "false");
        }
        xw.text(n(xw,reference.nodeId));

        xw.endElement();
    }
    xw.endElement();

}


// istanbul ignore next
BaseNode.prototype.dumpXML = function (xmlWriter) {
    console.error(" This ", this.nodeClass);
    assert(false, "BaseNode#dumpXML NOT IMPLEMENTED !");
    assert(xmlWriter);
};

const utils = require("node-opcua-utils");

function _dumpVariantExtensionObjectValue_Body(xw, schema, value) {

    xw.startElement(schema.name);
    if (value) {
        schema.fields.forEach(function (field) {
            xw.startElement(utils.capitalizeFirstLetter(field.name));
            const v = value[field.name];
            if (v !== null && v !== undefined) {
                //xx console.log("xxxxx field",field," V ".red,v);
                switch (field.fieldType) {
                    case "UInt64":
                    case "Int64":
                        xw.text(v[1].toString());
                        break;
                    case "LocalizedText":
                        xw.startElement("Locale");
                        if (v.locale) {
                            xw.text(v.locale);
                        }
                        xw.endElement();
                        xw.startElement("Text");
                        if (v.text) {
                            xw.text(v.text);
                        }
                        xw.endElement();
                        break;
                    default:
                        xw.text(v.toString());
                }
            }
            xw.endElement();
        });
    }
    xw.endElement();


}

const getStructureTypeConstructor = require("node-opcua-factory").getStructureTypeConstructor;
const getStructuredTypeSchema = require("node-opcua-factory").getStructuredTypeSchema;
const hasStructuredType = require("node-opcua-factory").hasStructuredType;

/* encode object as XML */
function _dumpVariantExtensionObjectValue(xw, schema, value) {

    xw.startElement("ExtensionObject");
    {
        xw.startElement("TypeId");
        {
            // find HasEncoding node
            const encodingDefaultXml = getStructureTypeConstructor(schema.name).encodingDefaultXml;
            if (!encodingDefaultXml) {
                console.log("?????");
            }
            //xx var encodingDefaultXml = schema.encodingDefaultXml;
            xw.startElement("Identifier");
            xw.text(encodingDefaultXml.toString());
            xw.endElement();
        }
        xw.endElement();

        xw.startElement("Body");
        _dumpVariantExtensionObjectValue_Body(xw, schema, value);
        xw.endElement();
    }
    xw.endElement();
}

function _dumpValue(xw, node, value) {
    const addressSpace = node.addressSpace;

    if (!value) {
        return;
    }

    assert(value instanceof Variant);

    const dataTypeName = addressSpace.findNode(node.dataType).browseName.toString();

    const baseDataTypeName = DataType[DataType[value.dataType]];


    // console.log("nodeset_to_xml #_dumpValue Cannot find ", dataTypeName,node.dataType.toString());
    if (!hasStructuredType(dataTypeName))
        return; // this is not a extension object

    const schema = getStructuredTypeSchema(dataTypeName);

    //xx console.log("xxxxxxxxx schema".cyan,dataTypeName.yellow,schema);
    function encodeXml(value) {
        _dumpVariantExtensionObjectValue_Body(xw, schema, value);
    }

    xw.startElement("Value");


    // determine if dataTypeName is a ExtensionObject
    const isExtensionObject = dataTypeName === "LocalizedText" ? false : true;

    if (isExtensionObject) {

        if (value.arrayType === VariantArrayType.Array) {
            xw.startElement("ListOf" + baseDataTypeName);
            value.value.forEach(_dumpVariantExtensionObjectValue.bind(null, xw, schema));
            xw.endElement();
        } else if (value.arrayType === VariantArrayType.Scalar) {
            _dumpVariantExtensionObjectValue(xw, schema, value);
        }
    } else {


        if (value.arrayType === VariantArrayType.Array) {


            xw.startElement("ListOf" + baseDataTypeName);
            xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2008/02/Types.xsd");

            value.value.forEach(encodeXml);

            xw.endElement();

        } else if (value.arrayType === VariantArrayType.Scalar) {
            encodeXml(value.value);
        }
    }

    xw.endElement();
}


function _dumpArrayDimensions(xw, node) {
    if (node.arrayDimension) {
        xw.writeAttribute("ArrayDimensions", node.arrayDimensions.join(','));
    }
}


function visitUANode(node, options,forward) {

    assert(_.isBoolean(forward));

    const addressSpace = node.addressSpace;
    options.elements = options.elements || [];
    options.index_el = options.index_el || {};

    // visit references
    function process_reference(reference) {

        //  only backward or foward refernces
        if (reference.isForward !== forward) {
            return;
        }

        if (reference.nodeId.namespace === 0) {
            return;// skip OPCUA namespace
        }
        const k = _hash(reference);
        if (!options.index_el[k]) {
            options.index_el[k] = 1;

            const o = addressSpace.findNode(k);
            if (o) {
                visitUANode(o, options,forward);
            }
        }
    }

    _.forEach(node.ownReferences(), process_reference);
    options.elements.push(node);
    return node;
}

function dumpReferencedNodesOld(xw,node,forward) {

    assert(_.isBoolean(forward));

    xw.visitedNode[_hash(node)]=1;

    const nodesToVisit = {};
    visitUANode(node, nodesToVisit,forward);

    for(let el of nodesToVisit.elements) {
        if (!xw.visitedNode[_hash(el)])
            el.dumpXML(xw);
    }
}

function dumpReferencedNodes(xw,node,forward) {


    const addressSpace = node.addressSpace;
    if (!forward) {

        //
        {
            const r = node.findReferencesEx("HasTypeDefinition");
            if (r && r.length) {
                assert(r.length ===1);
                const typeDefinitionObj = Reference._resolveReferenceNode(addressSpace,r[0]);
                assert(typeDefinitionObj instanceof BaseNode);

                if (typeDefinitionObj.nodeId.namespace === node.nodeId.namespace)  {
                    // only output node if it is on the same namespace
                    if (!xw.visitedNode[_hash(typeDefinitionObj)])
                        typeDefinitionObj.dumpXML(xw);
                }
            }
        }

        //
        {
            const r = node.findReferencesEx("HasSubtype",BrowseDirection.Inverse);
            if (r && r.length) {
                const subTypeOf = Reference._resolveReferenceNode(addressSpace,r[0]);
                assert(r.length ===1);
                if (subTypeOf.nodeId.namespace === node.nodeId.namespace) {
                    // only output node if it is on the same namespace
                    if (!xw.visitedNode[_hash(subTypeOf)])
                        subTypeOf.dumpXML(xw);
                }
            }
        }
    } else {
        const r = node.findReferencesEx("Aggregates",BrowseDirection.Forward);
        for(let reference of r) {
            const nodeChild = Reference._resolveReferenceNode(addressSpace,reference);
            assert(nodeChild instanceof BaseNode);
            if (nodeChild.nodeId.namespace === node.nodeId.namespace) {
                if (!xw.visitedNode[_hash(nodeChild)])
                    nodeChild.dumpXML(xw);
            }
        }
    }
}

function dumpCommonAttributes(xw,node) {

    xw.writeAttribute("NodeId", n(xw,node.nodeId));
    xw.writeAttribute("BrowseName", b(xw,node.browseName));

    if (node.hasOwnProperty("symbolicName")) {
        xw.writeAttribute("SymbolicName", node.symbolicName);
    }
    if (node.hasOwnProperty("isAbstract")) {
        if(node.isAbstract) {
            xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
        }
    }

}
function dumpCommonElements(xw, node) {
    _dumpDisplayName(xw, node);
    _dumpDescription(xw, node);
    _dumpReferences(xw, node);
}



function _dumpUADataTypeDefinition(xw, node) {

    const indexes = node._getDefinition();
    if (indexes) {
        xw.startElement("Definition");
        xw.writeAttribute("Name", node.definitionName);

        _.forEach(indexes.nameIndex, function (defItem, key) {

            xw.startElement("Field");
            xw.writeAttribute("Name", defItem.name);

            if (defItem.dataType && !defItem.dataType.isEmpty()) {
                // there is no dataType on enumeration
                const dataTypeStr = defItem.dataType.toString();
                xw.writeAttribute("DataType", dataTypeStr);
            }

            if (!utils.isNullOrUndefined(defItem.valueRank)) {
                xw.writeAttribute("ValueRank", defItem.valueRank);
            }
            if (!utils.isNullOrUndefined(defItem.value)) {
                xw.writeAttribute("Value", defItem.value);
            }
            if (defItem.description) {
                xw.startElement("Description");
                xw.text(defItem.description);
                xw.endElement();
            }
            xw.endElement();
        });
        xw.endElement();
    }
}

function dumpUADataType(xw, node) {
    xw.startElement("UADataType");
    xw.writeAttribute("NodeId", n(xw,node.nodeId));
    xw.writeAttribute("BrowseName", b(xw,node.browseName));

    if (node.isAbstract) {
        xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
    }
    _dumpReferences(xw, node);
    _dumpUADataTypeDefinition(xw, node);
    xw.endElement();
}

UADataType.prototype.dumpXML = function (xw) {
    dumpUADataType(xw, this);
};


function dumpUAVariable(xw, node) {

    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    dumpReferencedNodes(xw, node, false);

    const addressSpace = node.addressSpace;

    xw.startElement("UAVariable");
    {
        // attributes
        dumpCommonAttributes(xw,node);

        if (node.valueRank !== -1) {
            xw.writeAttribute("ValueRank", node.valueRank);
        }

        const dataTypeNode = addressSpace.findNode(node.dataType);
        if (!dataTypeNode) {
            throw new Error(" cannot find datatype " + node.dataType);
        }

        // verify that data Type is in alias
        const dataTypeName = dataTypeNode.browseName.toString();
        xw.writeAttribute("DataType", dataTypeName);

    }
    {
        // sub elements
        dumpCommonElements(xw,node);
        _dumpArrayDimensions(xw, node);
        _dumpValue(xw, node, node._dataValue.value);
    }
    xw.endElement();

    dumpAggregates(xw,node);
}
UAVariable.prototype.dumpXML = function (xw) {
    dumpUAVariable(xw, this);
};

function dumpUAVariableType(xw, node) {

    xw.visitedNode = xw.visitedNode || {};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    dumpReferencedNodes(xw, node, false);

    const addressSpace = node.addressSpace;

    xw.startElement("UAVariableType");

    {
        // attributes
        dumpCommonAttributes(xw,node);

        if (node.valueRank !== -1) {
            xw.writeAttribute("ValueRank", node.valueRank);
        }
        const dataTypeNode = addressSpace.findNode(node.dataType);
        if (!dataTypeNode) {
            //throw new Error(" cannot find datatype " + node.dataType);
            console.log(" cannot find datatype " + node.dataType + " for node " + node.browseName.toString() + " id =" + node.nodeId.toString());
        } else {
            const dataTypeName = dataTypeNode.browseName.toString();
            xw.writeAttribute("DataType", dataTypeName);

        }
    }
    {
        // sub elements
        dumpCommonElements(xw, node);
        _dumpArrayDimensions(xw, node);
        _dumpValue(xw, node, node.value);
    }

    xw.endElement();

    dumpAggregates(xw,node);
}

UAVariableType.prototype.dumpXML = function (xw) {
    dumpUAVariableType(xw, this);
};


function dumpUAObject(xw, node) {

    xw.writeComment("Object - " + b(xw,node.browseName) + " {{{{ ");

    xw.visitedNode = xw.visitedNode ||{};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    // dump SubTypeOf and HasTypeDefinition
    dumpReferencedNodes(xw,node,false);

    xw.startElement("UAObject");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    // dump aggregates nodes ( Properties / components )

    dumpAggregates(xw,node);

    xw.writeComment("Object - " + b(xw,node.browseName) + " }}}} ");
}

UAObject.prototype.dumpXML = function (xw) {
    dumpUAObject(xw, this);
};

function dumpAggregates(xw,node) {

    //Xx xw.writeComment("Aggregates {{ ");
    const aggregates = node.getAggregates().sort(x=>x.browseName.name.toString());
    for(let aa of aggregates) {
        if (!xw.visitedNode[_hash(aa)]) {
            aa.dumpXML(xw);
        }
    }
    //Xx xw.writeComment("Aggregates }} ");
}
function dumpUAObjectType(xw, node) {

    assert(node instanceof UAObjectType);
    xw.writeComment("ObjectType - " + b(xw,node.browseName) + " {{{{ ");
    xw.visitedNode = xw.visitedNode ||{};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    // dump SubTypeOf and HasTypeDefinition
    dumpReferencedNodes(xw,node,false);

    xw.startElement("UAObjectType");
    dumpCommonAttributes(xw, node);
    dumpCommonElements(xw, node);
    xw.endElement();

    dumpAggregates(xw,node);
    
    xw.writeComment("ObjectType - " + b(xw,node.browseName) + " }}}}");
}

UAObjectType.prototype.dumpXML = function (xw) {
    dumpUAObjectType(xw, this);
};

function dumpUAMethod(xw, node) {

    xw.visitedNode = xw.visitedNode ||{};
    assert(!xw.visitedNode[_hash(node)]);
    xw.visitedNode[_hash(node)] = 1;

    dumpReferencedNodes(xw,node,false);

    xw.startElement("UAMethod");
    dumpCommonAttributes(xw, node);
    xw.endElement();

    dumpAggregates(xw,node,true);
}

UAMethod.prototype.dumpXML = function (xw) {
    dumpUAMethod(xw, this);
};


function resolveDataTypeName(addressSpace,dataType) {

    // istanbul ignore next
    if (_.isString(dataType)) {
        return addressSpace.findDataType(dataType);
    }
    assert(dataType instanceof NodeId);
    const o = addressSpace.findNode(dataType.toString());
    return o ? o.browseName: null;
}

function buildUpAliases(node,xw,options) {

    const addressSpace = node.addressSpace;

    options.aliases = options.aliases || {};
    options.aliases_visited = options.aliases_visited || {};

    const k = _hash(node);
    // istanbul ignore next
    if (options.aliases_visited[k]) {
        return;
    }
    options.aliases_visited[k] = 1;

    
    // put datatype into aliases list
    if (node.dataType && node.dataType.namespace === 0) {
        // name
        const dataTypeName = b(xw,resolveDataTypeName(addressSpace,node.dataType));
        if (dataTypeName) {
            if (!options.aliases[dataTypeName]) {
                options.aliases[dataTypeName] = node.dataType;
            }
        }
    }

    function collectReferenceNameInAlias(reference) {
        // reference.referenceType
        const key = b(xw,reference._referenceType.browseName);
        if (!options.aliases.key) {
            if (reference.referenceType.namespace === 0) {
                options.aliases[key] = reference.referenceType.toString().replace("ns=0;","");
            } else {
                options.aliases[key] = n(xw,reference.referenceType);
            }
        }
      }
    _.forEach(node.allReferences(), collectReferenceNameInAlias);

}

function writeAliases(xw, aliases) {

    xw.startElement("Aliases");

    const keys =Object.keys(aliases).sort();

    for(let key of keys) {
        xw.startElement("Alias");
        xw.writeAttribute("Alias", key);
        xw.text(aliases[key].toString().replace(/ns=0;/,""));
        xw.endElement();
    }

    xw.endElement();
}


function constructNamespaceDependency(namespace) {

    const addressSpace = namespace.addressSpace;

    // navigate all namespace recursively to
    // find dependency
    const dependency = [];
    const depMap = new Set();

    // default namespace is always first
    dependency.push(addressSpace.getDefaultNamespace());
    depMap.add(dependency[0].index);

    if (namespace!==addressSpace.getDefaultNamespace()) {
        dependency.push(namespace);
        depMap.add(namespace.index);
    }

    for (const node of _.values(namespace._nodeid_index)) {
        // visit all reference
        const references = node.ownReferences();
        for (let reference of references) {
            // check referenceId
            const namespaceIndex= reference._referenceType.nodeId.namespace;
            if (!depMap.has(namespaceIndex)) {
                depMap.add(namespaceIndex);
                dependency.push(addressSpace.getNamespace(namespaceIndex));
            }
            const namespaceIndex2= reference.nodeId.namespace;
            if (!depMap.has(namespaceIndex2)) {
                depMap.add(namespaceIndex2);
                dependency.push(addressSpace.getNamespace(namespaceIndex2));
            }
        }
    }
    return dependency;
}
function constructNamespaceTranslationTable(dependency) {

    const translationTable ={
    };
    for (let i =0;i< dependency.length; i++ ) {
        translationTable[dependency[i].index] = i;
    }
    return translationTable;
}

function dumpReferenceType(xw,referenceType){

    xw.startElement("UAReferenceType");

    dumpCommonAttributes(xw, referenceType);

    dumpCommonElements(xw,referenceType);

    if(referenceType.inverseName /* LocalizedText*/) {
        //console.log("referenceType.inverseName)",referenceType.inverseName);
        xw.startElement("InverseName");
        xw.text(referenceType.inverseName.text);
        xw.endElement();
    }

    xw.endElement();
}

const sortByBrowseName = function(x,y){
    const a = x.browseName.toString();
    const b = y.browseName.toString();
    if (a>b) {
        return -1;
    } else if (a<b) {
        return 1;
    }
    return 0;
};

function dumpXml(node, options) {

    const addressSpace = node.addressSpace;

    const namespace =node.namespace;

    // make a first visit so that we determine which node to output and in which order
    const nodesToVisit = {};

    const dependency= constructNamespaceDependency(namespace);
    const translationTable = constructNamespaceTranslationTable(dependency);

    const xw = new XMLWriter(true);
    xw.translationTable = translationTable;


    visitUANode(node, nodesToVisit,false);


    xw.startDocument({encoding: "utf-8"});
    xw.startElement("UANodeSet");
    xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:xsd", "http://www.w3.org/2001/XMLSchema");
    xw.writeAttribute("Version", "1.02");
    xw.writeAttribute("LastModified", (new Date()).toISOString());
    xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");

    buildUpAliases(node,xw, nodesToVisit);
    writeAliases(xw, nodesToVisit.aliases);

    for(let el of nodesToVisit.elements) {
        el.dumpXML(xw);
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
}


exports.dumpXml = dumpXml;


Namespace.prototype.toNodeset2XML = function() {

    const namespace = this;

    const dependency= constructNamespaceDependency(namespace);
    const translationTable = constructNamespaceTranslationTable(dependency);

    const xw = new XMLWriter(true);
    xw.translationTable = translationTable;




    xw.startDocument({encoding: "utf-8",version: "1.0"});
    xw.startElement("UANodeSet");

    xw.writeAttribute("xmlns:xsi",  "http://www.w3.org/2001/XMLSchema-instance");
    xw.writeAttribute("xmlns:uax",  "http://opcfoundation.org/UA/2008/02/Types.xsd");
    xw.writeAttribute("xmlns",      "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");
    //xx xw.writeAttribute("Version", "1.02");
    //xx xw.writeAttribute("LastModified", (new Date()).toISOString());

    // ------------- Namespace Uris
    xw.startElement("NamespaceUris");

   //xx const namespaceArray = namespace.addressSpace.getNamespaceArray();
    for (let i=0;i<dependency.length;i++) {
        xw.startElement("Uri");
        xw.text(dependency[i].namespaceUri);
        xw.endElement();
    }

    xw.endElement();

    // ------------- Namespace Uris
    xw.startElement("Models");
    xw.endElement();

    const s = {};
    for (const node of _.values(namespace._nodeid_index)) {
        buildUpAliases(node,xw, s);
    }
    writeAliases(xw, s.aliases);

    xw.visitedNode = {};

    // -------------- writeReferences
    xw.writeComment("ReferenceTypes");
    const referenceTypes = _.values(namespace._referenceTypeMap).sort(sortByBrowseName);
    for(let referenceType of referenceTypes) {
        dumpReferenceType(xw,referenceType);
    }
    // -------------- ObjectTypes
    xw.writeComment("ObjectTypes");
    const objectTypes = _.values(namespace._objectTypeMap).sort(sortByBrowseName);
    //xx xw.writeComment(" "+ objectTypes.map(x=>x.browseName.name.toString()).join(" "));
    for(let objectType of objectTypes) {
        if (!xw.visitedNode[_hash(objectType)])
            objectType.dumpXML(xw);
    }

    // -------------- VariableTypes
    xw.writeComment("VariableTypes");
    const variableTypes = _.values(namespace._variableTypeMap).sort(sortByBrowseName);
    //xx xw.writeComment("ObjectTypes "+ variableTypes.map(x=>x.browseName.name.toString()).join(" "));
    for(let variableType of variableTypes) {
        if (!xw.visitedNode[_hash(variableType)])
            variableType.dumpXML(xw);
    }

    // -------------- Any thing else
    xw.writeComment("Other Nodes");
    const nodes =  _.values(namespace._node_index).sort(sortByBrowseName);
    //xx xw.writeComment(" "+ nodes.map(x=>x.browseName.name.toString()).join(" "));
    for(let node of nodes) {
        if (!xw.visitedNode[_hash(node)])
            node.dumpXML(xw);
    }

    xw.endElement();
    xw.endDocument();
    return xw.toString();
};

