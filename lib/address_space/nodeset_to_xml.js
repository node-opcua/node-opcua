"use strict";
// produce nodeset xml files
var XMLWriter = require("xml-writer");

var UAVariable = require("./ua_variable").UAVariable;
var BaseNode = require("./base_node").BaseNode;
var UADataType = require("./ua_data_type").UADataType;
var UAObject = require("./ua_object").UAObject;
var UAObjectType = require("./ua_object_type").UAObjectType;
var UAMethod = require("./ua_method").UAMethod;

var assert = require("better-assert");


function _dumpDisplayName(xw,node) {
    xw.startElement("DisplayName").text(node.displayName[0].text).endElement();
}
function _dumpDescription(xw,node) {
    if (node.description) {
        var desc = node.description.text;
        console.log("desc",desc);
        desc = desc || "";
        xw.startElement("Description").text(desc).endElement();
    }
}

function _dumpReferences(xw,node) {
    xw.startElement("References");
    node._references.forEach(function(reference){
        xw.startElement("Reference");
            xw.writeAttribute("ReferenceType",reference.referenceType);
            if (!reference.isForward) {
                xw.writeAttribute("IsForward",reference.isForward?"true":"false");
            }
            xw.text(reference.nodeId.toString());
        xw.endElement();
    });
    xw.endElement();

}


BaseNode.prototype.dumpXML = function(xmlWriter) {

    console.log(" This ",this.nodeClass);
    assert(false," NOT IMPLEMENTED !");
};

function dumpUAVariable(xw,node) {

    var address_space = node.__address_space;
    xw.startElement('UAVariable');
    xw.writeAttribute("NodeId",node.nodeId.toString());
    xw.writeAttribute("BrowseName",node.browseName);
    xw.writeAttribute("SymbolicName",node.symbolicName);

    var dataTypeName = address_space.findObject(node.dataType).browseName;
    xw.writeAttribute("DataType",dataTypeName);

    _dumpDisplayName(xw,node);
    _dumpDescription(xw,node);

    _dumpReferences(xw,node);
    xw.endElement();

}

UAVariable.prototype.dumpXML = function(xw) {
    dumpUAVariable(xw,this);
};


function dumpUADataType(xw,node) {
    xw.startElement('UADataType');
    xw.writeAttribute("NodeId",node.nodeId.toString());
    xw.writeAttribute("BrowseName",node.browseName);
    xw.writeAttribute("IsAbstract",node.isAbstract ? "true" :"false");
    xw.endElement();

}
UADataType.prototype.dumpXML = function(xw) {
    dumpUADataType(xw,this);
};

function dumpUAObject(xw,node) {

    xw.startElement('UAObject');
    xw.writeAttribute("NodeId",node.nodeId.toString());
    xw.writeAttribute("BrowseName",node.browseName);
    xw.writeAttribute("SymbolicName",node.symbolicName);

    _dumpDisplayName(xw,node);
    _dumpDescription(xw,node);

    _dumpReferences(xw,node);
    xw.endElement();

}
UAObject.prototype.dumpXML = function(xw) {
    dumpUAObject(xw,this);
};

function dumpUAObjectType(xw,node) {

    xw.startElement('UAObjectType');
    xw.writeAttribute("NodeId",node.nodeId.toString());
    xw.writeAttribute("BrowseName",node.browseName);
    xw.writeAttribute("IsAbstract",node.isAbstract ? "true" :"false");
    //xx xw.writeAttribute("SymbolicName",node.symbolicName);
    _dumpDisplayName(xw,node);
    _dumpDescription(xw,node);

    _dumpReferences(xw,node);
    xw.endElement();
}

UAObjectType.prototype.dumpXML = function(xw) {
    dumpUAObjectType(xw,this);
};

function dumpUAMethod(xw,node) {

    xw.startElement('UAObjectType');
    xw.writeAttribute("NodeId",node.nodeId.toString());
    xw.writeAttribute("BrowseName",node.browseName);
    xw.writeAttribute("IsAbstract",node.isAbstract ? "true" :"false");
    //xx xw.writeAttribute("SymbolicName",node.symbolicName);
    _dumpDisplayName(xw,node);
    _dumpDescription(xw,node);

    _dumpReferences(xw,node);
    xw.endElement();
}
UAMethod.prototype.dumpXML = function(xw) {
    dumpUAMethod(xw,this);
};


function visitUANode(node,options)
{

    console.log("X visiting ", node.nodeId.toString(),node.browseName);
    var address_space = node.__address_space;
    options.elements = options.elements || [];
    options.index_el = options.index_el || {};
    // visit references
    function process_reference(reference) {
        // reference.referenceType
        if (!reference.isForward) {
            return;
        }
        //xxconsole.log("reference=".cyan,reference);
        if (reference.nodeId.namespace === 0) {
            return;// skip OPCUA namespace
        }
        var k = reference.nodeId.toString();
        if (!options.index_el[k]) {
            options.index_el[k]=1;

            var o = address_space.findObject(k);
            if (o) {
                visitUANode(o,options);
            }
        }
    }
    node._references.forEach(process_reference);
    node._back_references.forEach(process_reference);
    options.elements.push(node);
    return node;
}



function dumpXml(node,options) {

    var address_space = node.__address_space;

    // make a first visit so that we determine which node to output and in which order
    var s= {};

    function buildUpAliases(node,options) {

        options.aliases = options.aliases || {};
        options.aliases_visited =  options.aliases_visited  || {};

        var k = node.nodeId.toString();

        if (options.aliases_visited[k]) {
            return;
        }
        options.aliases_visited[k]=1;


        // put datatype into aliases list
        if (node.dataType && node.dataType.namespace ===0) {
            // name
            var dataTypeName = address_space.findDataType(node.dataType);
            if (!options.aliases[dataTypeName]) {
                options.aliases[dataTypeName] = node.dataType;
            }
        }


        function add_in_aliases_map(key){
            if (!options.aliases.key) {
                var nodeId = address_space.resolveNodeId(key);
                if (nodeId.namespace === 0) {
                    options.aliases[key] = address_space.resolveNodeId(key);
                }

            }
        }
        function inner(reference) {
            // reference.referenceType
            var key = reference.referenceType;
            add_in_aliases_map(key);

            var o = address_space.findObject(reference.nodeId);
            if (o) {
                buildUpAliases(o,options);
            }
        }
        node._references.forEach(inner);
        node._back_references.forEach(inner);

    }
    function writeAliases(xw,aliases) {

        xw.startElement('Aliases');

        Object.keys(aliases).forEach(function(key) {
            xw.startElement('Alias');
            xw.writeAttribute("Alias",key);
            xw.text("i="+aliases[key].value.toString());
            xw.endElement();
        });

        xw.endElement();
    }

    buildUpAliases(node,s);

    var el = visitUANode(node,s);

    console.log(s.elements.map(function(e){ return e.nodeId.toString();}).join(" "));
    //xx s.elements.map(function(a){ console.log(a.nodeId.toString(), a.browseName); });


    var xw = new XMLWriter(true);
    xw.startDocument({encoding:"utf-8"});
    xw.startElement('UANodeSet');
        xw.writeAttribute("xmlns:xs","http://www.w3.org/2001/XMLSchema-instance");
        xw.writeAttribute("xmlns:xsd","http://www.w3.org/2001/XMLSchema");
        xw.writeAttribute("Version","1.02");
        xw.writeAttribute("LastModified",(new Date()).toISOString());
        xw.writeAttribute("xmlns","http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");

        writeAliases(xw, s.aliases);

        s.elements.forEach(function(el){ console.log(el.nodeClass);
            el.dumpXML(xw); });

    xw.endElement();
    xw.endDocument();
    return xw.toString();
}


exports.dumpXml = dumpXml;