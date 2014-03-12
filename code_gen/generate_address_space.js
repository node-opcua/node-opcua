var util = require('util');
var xml = require("node-expat");
var fs = require("fs");
var assert  = require('better-assert');

var coerceNodeId = require("../lib/nodeid").coerceNodeId;
var resolveNodeId = require("../lib/nodeid").resolveNodeId;
var ec = require("../lib/encode_decode");
var _ = require("underscore");


var AddressSpace = require("../lib/common/address_space").AddressSpace;

var findReference =   require("../lib/common/address_space").findReference;

var generate_address_space = require("../lib/common/load_nodeset2").generate_address_space;

var address_space = new AddressSpace();

generate_address_space(address_space);


var utils = require("../lib/utils");

var template_Object= function(){/*
£**
 *{{className}}
 * {{description}}
 *
 * @options:  construction values
 *
 *£
function  {{className}}(options) {
    assert(options);
    assert(options.nodeId);
    assert(options.browseName);
    {{baseClassName}}.apply(this,arguments);

    assert(this.typeDefinition.value === {{nodeId.value}});

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

    // find isSubtypeOf
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

function constructObjectFromTypeDefinition(nodeId , options)  {
    var typeDefinition =map[nodeId.toString()];
    console.log(" constructing a object of type : "  +typeDefinition.browseName);
    console.log(" with parameters ,",options)
};

function dumpObject(obj) {

    var parent = findReference(obj,"Organizes",false);

    var typeDefinitionRef = findReference(obj,"HasTypeDefinition",true);
    var typeDefinition =map[typeDefinitionRef.nodeId.toString()];

    constructObjectFromTypeDefinition(typeDefinitionRef.nodeId,obj);

    console.log(util.inspect(obj,{colors:true}));
    console.log(util.inspect(typeDefinition,{colors:true}));
    console.log(util.inspect(parent,{colors:true}));


};

//xx var folderType =findObjectByBrowseName("FolderType");
//xx dumpObjectType(folderType);

//xx var folder_Objects =findObjectByBrowseName("Objects");
//xx dumpObject(folder_Objects);

//xx var serverType =findObjectByBrowseName("ServerType");
//x dumpObjectType(serverType);

// xxdumpObjectType(map[coerceNodeId("ns=0;i=58")]);