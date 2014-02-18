var util = require('util');
var xml = require("node-expat");
var fs = require("fs");
//xx var csv = require("csv");
//xx var sprintf = require("sprintf").sprintf;
var assert  = require("assert");

var coerceNodeId = require("../lib/nodeid").coerceNodeId;
var resolveNodeId = require("../lib/nodeid").resolveNodeId;
var ec = require("../lib/encode_decode");
var _ = require("underscore");

function add_alias(alias_name,nodeid) {

   console.log(" adding alias "+ alias_name + " => "+ nodeid);
}

var map ={};
var mapOT = {};

function addUAObject(obj) {
    // console.log(" adding addUAObject " + obj.nodeId.toString() + " "+ obj.displayName);
    map[obj.nodeId.toString()] = obj;
}
function addUAVariable(obj) {
    // console.log(" adding addUAVariable " + obj.browseName + " " + obj.nodeId.toString() + " "+ obj.displayName);
//    console.dir(obj);
    map[obj.nodeId.toString()] = obj;
}
function addUAVariableType(obj) {
    // console.log(" adding addUAVariableType " + obj.browseName + " " + obj.nodeId.toString() + " "+ obj.displayName);
//    console.dir(obj);
    map[obj.nodeId.toString()] = obj;
}
function addUAReferenceType(obj) {
    //  console.log(" adding addUAReferenceType " + obj.nodeId.toString() + " "+ obj.displayName);
//    console.dir(obj);
    map[obj.nodeId.toString()] = obj;
}
function addUADataType(obj) {
    // console.log(" adding addUADataType " + obj.nodeId.toString() + " "+ obj.displayName);
//    console.dir(obj);
    map[obj.nodeId.toString()] = obj;
}
function addUAObjectType(obj) {
    //  console.log(" adding addUAObjectType " + obj.nodeId.toString() + " "+ obj.displayName);
//    console.dir(obj);
    map[obj.nodeId.toString()] = obj;
    mapOT[obj.nodeId.toString()] = obj;
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
    this._finish  = options.finish;
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
    if (this._endElement) {
        this._endElement(name);
    }
    if (name==this.name) {
        if (this._finish) {
            this._finish();
        }
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

    var xmlFile = __dirname + "/Opc.Ua.NodeSet2.xml";


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
                        nodeId:        coerceNodeId(this.text)
                    });
                }
            }
        }
    };

    var state_UAObject= {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.isAbstract = attrs["IsAbstract"] || false;
            this.obj.nodeId = coerceNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
        },
        finish: function(name) {
            addUAObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function() { this.parent.obj.displayName = this.text; }},
            'Description': {finish: function() { this.parent.obj.description = this.text; }},
            'References':  references_parser
        }
    };

    var state_UAObjectType = _.clone(state_UAObject);
    state_UAObjectType.finish= function(name) { addUAObjectType(this.obj);    };

    var state_UAReferenceType = _.clone(state_UAObject);
    state_UAReferenceType.finish= function(name) { addUAReferenceType(this.obj);    };

    var state_UADataType = _.clone(state_UAObject);
    state_UADataType.finish= function(name) { addUADataType(this.obj);    };


    var state_UAVariable = {
        init: function(name,attrs) {
            this.obj = {};
            this.obj.browseName   = attrs["BrowseName"] || null;
            this.obj.parentNodeId = attrs["ParentNodeId"] || null;
            this.obj.dataType     = attrs["DataType"] || null;
            this.obj.valueRank    = attrs["ValueRank"] || null;
            this.obj.minimumSamplingInterval= attrs["MinimumSamplingInterval"] || null;
            this.obj.nodeId       = coerceNodeId(attrs["NodeId"]) || null;

        },
        finish: function(name) {
            addUAVariable(this.obj);
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
            'UAObject':         state_UAObject,
            'UAObjectType':     state_UAObjectType,
            'UAReferenceType':  state_UAReferenceType,
            'UADataType':       state_UADataType,
            'Aliases':    { parser: { 'Alias':    state_Alias } },
            'UAVariable':     state_UAVariable,
            'UAVariableType': state_UAVariable
        }
    };

    var parser = new Xml2Json(state_0);
    parser.parse(xmlFile);


    console.log(util.inspect( map["ns=0;i=84"], {colors:true,depth:4  }) );
    console.log(util.inspect( map["ns=0;i=85"], {colors:true,depth:4  }) );
    console.log(util.inspect( map["ns=0;i=86"], {colors:true,depth:4  }) );
    console.log(util.inspect( map["ns=0;i=87"], {colors:true,depth:4  }) );
    console.log(util.inspect( map["ns=0;i=2253"], {colors:true,depth:4}) );
    console.log(util.inspect( map["ns=0;i=2254"], {colors:true,depth:4}) );
    console.log(util.inspect( map["ns=0;i=2255"], {colors:true,depth:4}) );
    console.log(" " + JSON.stringify(map["ns=0;i=2255"],0," ") );
}
generate_address_space();

function findByBrowseName(browseNameToFind) {
    return _.find(map,function(el){ return el.browseName === browseNameToFind});
}


var utils = require("../lib/utils");


var template_Object= function(){/*
&**
 *{{className}}
 * {{description}}
 *
 * @options:  construction values
 *
 *&
function   {{className}}(options) {
    assert(options);
    assert(options.nodeId);
    assert(options.browseName);
    {{baseClassName}}.apply(this,arguments);

    assert(this.typeDefinition.value === {{nodeId.value}});

    this.nodeId = resolveNodeId(options.nodeId);
    this.browseName = options.browseName;
    options.displayName = options.displayName || options.browseName; // xx { locale: "en", text: options.browseName };
    this.displayName = [];
    if (typeof options.displayName === "string") {
         this.displayName.push(new s.LocalizedText({ locale: "en", text: options.displayName }));
    }

    //---------------------------------- properties
    {{#properties}}

    // {{comment}}
    {{#isArray}}
    this.{{name}} = [];

    {{/isArray}}
    {{^isArray}}
    this.{{name}} = options.{{name}};

    {{/isArray}}
    {{/properties}}

    //---------------------------------- components

    {{#components}}
    {{#name}}
    // {{comment}}
    this.{{name}} = new {{className}}(options.{{name}});

    {{/name}}
    {{/components}}

}
util.inherits({{className}},{{baseClassName}});
{{className}}.prototype.typeDefinition = resolveNodeId("{{classNameType}}");

 */}
var Mustache = require("mustache");
function inlineText(f) {
    return f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
}

function findReference(object,strReference,isForward) {
    if( undefined === object) {
        console.log(" missing refrence " + object);
        return;
    }
    assert(object.references);
    // console.log(object.references);
    var f = _.find(object.references,function(ref){
        return ref.referenceType == strReference && ref.isForward == isForward}
    );
    return f;
}
function filterReference(object,strReference,isForward) {
    assert(object.references);
    // console.log(object.references);
    var f = _.filter(object.references,function(ref){
            return ref.referenceType == strReference && ref.isForward == isForward}
    );
    return f;
}

var done = {}
function dumpObjectType(objectType)
{
    if (done  in objectType) {
        return;
    }
    done[objectType] = objectType;

    function removeType(str) {
        return str.substr(0,str.length-4);
    }
   // console.log(util.inspect(objectType,{colors:true,depth:10}) );

    // find hasSubType
    var st = findReference(objectType,"HasSubtype",false);
    assert(st);
    if (st) {
        var baseClassType = map[st.nodeId];
        var baseClassName = removeType(baseClassType.browseName);
    }
    // find properties
    var properties = filterReference(objectType,"HasProperty"  ,true);
    var components = filterReference(objectType,"HasComponent",true);

    function lc(str) {
        return str[0].toLowerCase()+ str.substr(1);
    }
    properties = properties.map(function(property){
        var obj =map[property.nodeId.toString()];
        if (obj) {
            var info = {
                name: lc(obj.browseName),
                type: obj.dataType,
                comment: obj.description,
                isArray:(obj.valueRank === '1')
            };
            return info;
        }
        return  {};
    });
    //xx console.log(" properties = ",util.inspect(properties,{colors : true, depth: 10}));

    //xx console.log(" components = ",util.inspect(components,{colors : true, depth: 10}));
    components = components.map(function(component){
        //xx console.log(component.nodeId.toString());
        var obj =map[component.nodeId.toString()];
        var typeDefinitionRef = findReference(obj,"HasTypeDefinition",true);
        if (!typeDefinitionRef) {
            typeDefinitionRef = findReference(obj,"HasSubtype",false);
        }
        if (typeDefinitionRef) {
            var typeDefinition =map[typeDefinitionRef.nodeId.toString()];
            //xx console.log("====>",typeDefinitionRef.nodeId.toString());
            dumpObjectType(typeDefinition);
        }

        if (obj) {
            //xx console.log(obj);
            var info = {
                name: lc(obj.browseName),
                className: obj.browseName,
                comment: obj.description
            };
            return info;
        } else {
            return {};
        }
    });

    var txt = Mustache.render(inlineText(template_Object),{
         classNameType: objectType.browseName,
         className:  removeType(objectType.browseName),
         description: objectType.description,
         baseClassName: baseClassName,
         nodeId: objectType.nodeId,
         properties: properties,
         components: components
    });

    console.log(txt);

}
var folderType =findByBrowseName("FolderType");
dumpObjectType(folderType);


var serverType =findByBrowseName("ServerType");
//x dumpObjectType(serverType);

// xxdumpObjectType(map[coerceNodeId("ns=0;i=58")]);