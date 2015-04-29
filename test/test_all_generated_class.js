require("requirish")._(module);
var factories = require("lib/misc/factories");
var _defaultTypeMap = require("lib/misc/factories_builtin_types")._defaultTypeMap;

var fs = require("fs");
var _ = require("underscore");

function getFiles(dir, files_) {
    files_ = files_ || [];
    if (typeof files_ === 'undefined') files_ = [];
    var files = fs.readdirSync(dir);
    for (var i in files) {
        if (!files.hasOwnProperty(i)) continue;
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()) {
            //xx getFiles(name,files_);
        } else {
            files_.push(name);
        }
    }
    return files_;
}

require("lib/datamodel/numeric_range");
require("lib/datamodel/variant");
require("lib/datamodel/buildinfo");
require("lib/services/browse_service");
require("lib/services/historizing_service");
require("lib/datamodel/opcua_status_code");
require("schemas/ServerState_enum");
require("schemas/ServerStatus");
require("lib/services/write_service");

var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

var folder_for_generated_file = require("lib/misc/factory_code_generator").folder_for_generated_file;

var services_folder = __dirname + "/../lib/services";

if (fs.existsSync("../_generated_/_auto_generated_SCHEMA_ServerState")) {
    require("../_generated_/_auto_generated_SCHEMA_ServerState");
}

describe("testing all auto_generated Class", function () {

    var services_javascript_source = getFiles(services_folder);
    services_javascript_source.forEach(function (filename) {
        require(filename);
    });

    var files = getFiles(folder_for_generated_file);
    files = files.filter(function (f) {
        return (f.indexOf("_auto_generated_") > 0 && f.indexOf("SCHEMA") == -1);
    });

    // remove Callxxxx class that requires a special treatment
    files = files.filter(function (f) { return  ! (f.indexOf("_Call") > 0); });


    files.forEach(function (filename) {

        var re = /.*_auto_generated_(.*)\.js/;

        var name = re.exec(filename)[1];
        //xx console.log(name);

        it("verify auto generated class encoding and decoding " + name, function () {

            var CLASSCONSTRUCTOR = require(filename)[name];

            var schema = CLASSCONSTRUCTOR.prototype._schema;
            var options = {};

            schema.fields.forEach(function (field) {
                if (field.isArray) {
                    if (_defaultTypeMap[field.fieldType]) {
                        var defVal = _defaultTypeMap[field.fieldType].defaultValue;

                        if (defVal != undefined) {
                            if (_.isFunction(defVal)) {
                                options[field.name] = [defVal(), defVal(), defVal()];

                            } else {
                                //xx console.log(field.name);
                                options[field.name] = [defVal, defVal, defVal];
                            }
                        }
                    } else {

                        options[field.name] = [{}, {}, {}];
                    }
                }
            });


            var obj = new CLASSCONSTRUCTOR(options);
            encode_decode_round_trip_test(obj);
            obj.explore();

            var txt = obj.toString();


        });

    })

});
