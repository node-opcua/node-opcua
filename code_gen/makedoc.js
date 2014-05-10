var _ = require("underscore");
var assert=require("assert");

console.log("/**");
console.log(" * @module toto");
console.log(" */");

dumpModule(require("../lib/variant.js"));
dumpModule(require("../lib/buildinfo.js"));
dumpModule(require("../lib/browse_service.js"));
dumpModule(require("../lib/factories.js"));
dumpModule(require("../lib/subscription_service.js"));
dumpModule(require("../lib/read_service.js"));
dumpModule(require("../lib/session_service.js"));
dumpModule(require("../lib/write_service.js"));
dumpModule(require("../lib/translate_browse_paths_to_node_ids_service.js"));
dumpModule(require("../lib/structures.js"));
dumpModule(require("../lib/secure_channel_service.js"));
dumpModule(require("../lib/register_server_service.js"));
dumpModule(require("../lib/nodeopcua.js"));
dumpModule(require("../lib/datavalue.js"));



function dumpClass(schema) {

    // assert(schema.hasOwnProperty("comment"));

    var className = schema.name;

    var documentation = schema.documentation;
    console.log("/**")
    console.log(" * " + documentation);
    console.log(" * @class ", className);
    console.log(" * @extends ", "BaseObject");

    console.log(" * @constructor ", className);


    console.log(" * @param {Object} options - Options to initialize the component with");

    if (true) {
        _.forEach(Object.keys(schema.fields), function (b) {
            var field = schema.fields[b];
            var name = field.name;
            var fieldType = field.fieldType;
            var documentation = field.documentation;

            var propertyName = name;
            var propertyType = fieldType;
            var s = "{{#crossLink \""  + className +"/"+ propertyName +":attribute" +"\" }}{{/crossLink }}";
            console.log(" * @param {" + propertyType + "} options." + propertyName + " - " + documentation + " " + s);
        });
    }
    console.log(" *\/");


if(false) {
    _.forEach(Object.keys(schema.fields), function (b) {
        var field = schema.fields[b];
        var name = field.name;
        var fieldType = field.fieldType;
        var documentation = field.documentation;
        console.log(" *  @property ", " {", fieldType, "}", name, "  ", documentation);
    });
}
//xx   console.log('function ',a + "() {");
//xx   console.log("}");
    if (true) {
        _.forEach(Object.keys(schema.fields), function (b) {
            var field = schema.fields[b];
            var name = field.name;
            var fieldType = field.fieldType;
            var documentation = field.documentation;
            console.log("/**")
            console.log(" * "+ documentation);
            console.log(" *  @property ",name);
            console.log(" *  @type ",fieldType);
            console.log(" *\/");
//xx            console.log("this." + name, " = {};");
        });
    }

}
function dumpModule(module) {

    assert(module);

    _.forEach(Object.keys(module), function (a) {

        var obj = module [a];

        if (!obj) {
            return;
        }
//xx    _.forEach(Object.keys(obj),function(b) {
//xx        console.log("  ",b);
//xx    });

        if (obj.hasOwnProperty("prototype") && obj.prototype.hasOwnProperty("_schema")) {

            var schema = obj.prototype._schema;

            dumpClass(schema);

        }

    });
}


// ref http://stackoverflow.com/questions/10490713/how-to-document-the-properties-of-the-object-in-the-jsdoc-3-tag-this
