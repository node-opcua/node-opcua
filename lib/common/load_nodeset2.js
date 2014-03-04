var Xml2Json = require("../xml2json/lib").Xml2Json;
var NodeClass = require("../browse_service").NodeClass;
var assert  = require('better-assert');
var resolveNodeId = require("../nodeid").resolveNodeId;
var _ = require("underscore");
var AddressSpace = require("../common/address_space").AddressSpace;


function coerceBoolean(obj,property,defaultValue) {
    if (obj.hasOwnProperty(property)) {
        return !!obj[property];
    }
    return defaultValue;
}
function generate_address_space(address_space,xmlFile,callback) {


    function add_alias(alias_name,nodeId) {
        nodeId = resolveNodeId(nodeId);
        address_space.add_alias(alias_name,nodeId);
    }
    function convertToNodeId(nodeId) {
        return address_space.resolveNodeId(nodeId);
    }

    assert(address_space instanceof AddressSpace);
    assert(_.isFunction(callback)); // expecting a callback

    var state_Alias = { finish: function() {  add_alias(this.attrs["Alias"],this.text); } };

    var references_parser = {
        init: function() {
            this.parent.obj.references = [];
            this.array = this.parent.obj.references;
        },
        startElement: function(name,attrs){
            //  console.log("name " ,name);
        },
        parser: {
            'Reference': {
                finish: function() {
                    this.parent.array.push({
                        referenceType: this.attrs["ReferenceType"],
                        isForward:     (this.attrs["IsForward"]  == undefined) ? true : (this.attrs["IsForward"] == "false" ? false : true),
                        nodeId:        convertToNodeId(this.text)
                    });
                }
            }
        }
    };

    var state_UAObject= {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.nodeClass  = NodeClass.Object;
            this.obj.isAbstract = coerceBoolean(attrs,"IsAbstract",false);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
            this.obj.eventNotifier = attrs["EventNotifier"] || 0
        },
        finish: function() {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser
        }
    };

    var state_UAObjectType= {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.nodeClass  = NodeClass.ObjectType;
            this.obj.isAbstract = coerceBoolean(attrs,"IsAbstract",false);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
            this.obj.eventNotifier = attrs["EventNotifier"] || 0;
        },
        finish: function() {
           address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser
        }
    };

    var state_UAReferenceType= {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.nodeClass  = NodeClass.ReferenceType;
            this.obj.isAbstract = coerceBoolean(attrs,"IsAbstract",false);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
        },
        finish: function() {
           address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'InverseName': {finish: function() { this.parent.obj.inverseName = this.text; }},
            'References':  references_parser
        }
    };

    var state_UADataType= {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.nodeClass  = NodeClass.DataType;
            this.obj.isAbstract = coerceBoolean(attrs,"IsAbstract",false);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
        },
        finish: function() {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser
        }
    };

    var state_UAVariable = {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.nodeClass      = NodeClass.Variable;
            this.obj.browseName     = attrs["BrowseName"] || null;
            this.obj.parentNodeId   = convertToNodeId(attrs["ParentNodeId"]);
            this.obj.dataType       = convertToNodeId(attrs["DataType"]);
            this.obj.valueRank      = attrs["ValueRank"] || 0;
            this.obj.arrayDimension = attrs["ArrayDimension"] || null;

            this.obj.minimumSamplingInterval= attrs["MinimumSamplingInterval"] ? parseInt(attrs["MinimumSamplingInterval"]) : 0;
            this.obj.historizing  = false;
            this.obj.nodeId       = convertToNodeId(attrs["NodeId"]) || null;

        },
        finish: function() {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser,
            'Value': {}
        }
    };
    var state_UAVariableType = {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.nodeClass    = NodeClass.VariableType;
            this.obj.isAbstract = coerceBoolean(attrs,"IsAbstract",false);
            this.obj.browseName   = attrs["BrowseName"] || null;
            this.obj.parentNodeId = attrs["ParentNodeId"] || null;
            this.obj.dataType     = convertToNodeId(attrs["DataType"])|| null;
            this.obj.valueRank    = attrs["ValueRank"] || null;
            this.obj.minimumSamplingInterval= attrs["MinimumSamplingInterval"] ? parseInt(attrs["MinimumSamplingInterval"]) : 0;
            this.obj.nodeId       = convertToNodeId(attrs["NodeId"]) || null;

        },
        finish: function() {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser,
            'Value': {}
        }
    };
    var state_0 = {
        parser: {
            'Aliases':          { parser: { 'Alias':    state_Alias } },
            'UAObject':         state_UAObject,
            'UAObjectType':     state_UAObjectType,
            'UAReferenceType':  state_UAReferenceType,
            'UADataType':       state_UADataType,
            'UAVariable':       state_UAVariable,
            'UAVariableType':   state_UAVariableType
        }
    };

    var parser = new Xml2Json(state_0);
    parser.parse(xmlFile,callback);

}
exports.generate_address_space = generate_address_space;
