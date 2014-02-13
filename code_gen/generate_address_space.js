var util = require('util');
var xml = require("node-expat");
var fs = require("fs");
//xx var csv = require("csv");
//xx var sprintf = require("sprintf").sprintf;
var assert  = require("assert");

var ec = require("../lib/encode_decode");

function add_alias(alias_name,nodeid) {

   console.log(" adding alias "+ alias_name + " => "+ nodeid);
}
function addUAObject(obj) {
    console.log(" adding addUAObject ");
    console.dir(obj);
}


function coerceReaderState(options_or_reader_state)
{
    if (!(options_or_reader_state instanceof ReaderState)) {
        return new ReaderState(options_or_reader_state);
    }
    var reader = options_or_reader_state;
    for( var name in reader.parser) {
        if (reader.parser.hasOwnProperty(name)) {
            reader.parser[name] = coerceReaderState(reader.parser[name]);
        }
    }
    return reader;
}

function ReaderState(options){
    this.parser= options.parser || {};
    this._init  = options.init;
    this._startElement = options.startElement;
    this._endElement = options.endElement;

    var reader = this;
    for( var name in reader.parser) {
        if (reader.parser.hasOwnProperty(name)) {
            reader.parser[name] = coerceReaderState(reader.parser[name]);
        }
    }
}

ReaderState.prototype.init= function(name,attrs) {
    this.attrs = attrs;
    assert(this.attrs);
    if (this._init) {
        this._init(name,attrs);
    }
};

ReaderState.prototype.startElement= function(name,attrs) {

    if (this.parser.hasOwnProperty(name)) {
        this.engine._promote(this.parser[name],name,attrs);
    } else  if (this._startElement) {
        this._startElement(name,attrs);
    }
};
ReaderState.prototype.endElement= function(name) {
    assert(this.attrs);
    if (this._endElement) { this._endElement(name);}
    if (name==this.name) {
        // this is the end
        this.engine._demote(this);
    }
};

ReaderState.prototype.onText = function(text){
    this.text = text;
};

function Xml2Json(state) {

    state = coerceReaderState(state);

    this.state_stack = [];
    this.current_state = null;
    this._promote(state);
}

Xml2Json.prototype._promote = function (new_state,name,attr) {
    attr = attr || {};
    new_state.name = name;
    new_state.parent = this.current_state;
    new_state.engine = this;

    this.state_stack.push(this.current_state);
    this.current_state = new_state;
    this.current_state.init(name,attr);
};

Xml2Json.prototype._demote = function(cur_state) {
    assert(this.current_state===cur_state);
    this.current_state = this.state_stack.pop();
};


Xml2Json.prototype.parse = function(xmlFile) {
    var self = this;
    var parser = new xml.Parser();
    parser.on('startElement',function(name,attrs)   {
        self.current_state.startElement(name,attrs);
    });
    parser.on('endElement',  function(name)         {
        self.current_state.endElement(name);
    });
    parser.on('text',        function(text)         {
        self.current_state.onText(text);
    });
    parser.write(fs.readFileSync(xmlFile));
};


function generate_address_space() {

    var xmlFile = "./Opc.Ua.NodeSet2.xml";


    var state_Alias = { endElement: function() {  add_alias(this.attrs["Alias"],this.text); } };

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
                endElement: function() {
                    this.parent.array.push({
                        referenceType: this.attrs["ReferenceType"],
                        isForward:     this.attrs["IsForward"],
                        nodeId:        ec.makeNodeId(this.text)
                    });
                }
            }
        }
    };

    var state_UAObject= {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.isAbstract = attrs["IsAbstract"] || null;
            this.obj.nodeId = ec.makeNodeId(attrs["NodeId"]) || null;
        },
        endElement: function(name) {
            addUAObject(this.obj);
        },
        parser: {
            'DisplayName': {endElement: function() { this.parent.obj.displayName = this.text; }},
            'Description': {endElement: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser
        }
    };
    var state_UAVariable = {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.browseName   = attrs["BrowseName"] || null;
            this.obj.parentNodeId = attrs["ParentNodeId"] || null;
            this.obj.dataType     = attrs["DataType"] || null;
            this.obj.valueRank    = attrs["ValueRank"] || null;
            this.obj.minimumSamplingInterval= attrs["MinimumSamplingInterval"] || null;
            this.obj.nodeId       = ec.makeNodeId(attrs["NodeId"]) || null;

        },
        endElement: function(name) {
            addUAVariable(this.obj);
        },
        parser: {
            'DisplayName': {endElement: function() { this.parent.obj.displayName = this.text; }},
            'Description': {endElement: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser,
            'Value': {}

        }

    };
    var state_0 = {
        parser: {
            'UAObject':         state_UAObject,
            'UAObjectType':     state_UAObject,
            'UAReferenceType':  state_UAObject,
            'UADataType':       state_UAObject,
            'Aliases':    { parser: { 'Alias':    state_Alias } },
            'UAVariable': state_UAVariable,
        }
    };

    var parser = new Xml2Json(state_0);
    parser.parse(xmlFile);


}

generate_address_space();
