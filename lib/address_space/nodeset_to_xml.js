// produce nodeset xml files
var XMLWriter = require("xml-writer");


function dumpUADataType(xw,node) {

    xw.startElement('UADataType');
    xw.writeAttribute("NodeId",node.nodeId.toString());
    xw.writeAttribute("BrowseName",node.browseName);
    xw.writeAttribute("IsAbstract",node.isAbstract ? "true" :"false");

    xw.endElement();

}
function _dumpDisplayName(xw,node) {
    xw.startElement("DisplayName").text(node.displayName[0].text).endElement();
}
function _dumpDescription(xw,node) {
    if (node.description) {
        xw.startElement("Description").text(node.description[0].text).endElement();
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

    // make a first visit so that we determine which node to output and in which order
    var s= {};

    var el = visitUANode(node,s);

    console.log(s.elements.map(function(e){ return e.nodeId.toString();}).join(" "));
    //xx s.elements.map(function(a){ console.log(a.nodeId.toString(), a.browseName); });

    var xw = new XMLWriter(true);
    xw.startDocument({encoding:"utf-8"});
    xw.startElement('UANodeSet');
        xw.writeAttribute("xmlns:xs","http://www.w3.org/2001/XMLSchema-instance");
        xw.writeAttribute("xmlns:xsd","http://www.w3.org/2001/XMLSchema");
        xw.writeAttribute("Version","1.02");
        xw.writeAttribute("LastModified","2013-03-06T05:36:44.0862658Z");
        xw.writeAttribute("xmlns","http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");
        xw.startElement('Aliases');
        xw.endElement();

        s.elements.forEach(function(el){
            dumpUAObject(xw,el);
        });

    xw.endElement();
    xw.endDocument();
    return xw.toString();
}


exports.dumpXml = dumpXml;