"use strict";
var fs = require("fs");
var path = require("path");
var async = require("async");
var child_process = require("child_process");

function dot(graph,callback) {

    var cmd = "dot -Tpdf -o_tmp.pdf" ;
    var child = child_process.exec(cmd,function(err) {
    });
    child.stdin.write(graph);
    child.stdin.end();
    child.stderr.pipe(process.stdout);
    child.on("close", function(code) {
        callback(null);
    });

}

function tred(inputfile,callback) {

    var cmd = "tred" ;
    var child = child_process.exec(cmd,function(err) {
    });

    child.stdin.write(inputfile);
    child.stdin.end();

    child.stderr.pipe(process.stdout);

    var result = "";
    child.stdout.on("data", function(data) {
        result += data.toString();
    });
    child.on("close", function() {
        console.log("done ... (" + ")");
        callback(null,result);
    });
}
function q(a) { return "\"" + a + "\"" ; }
var dependencies = [];
fs.readdir(__dirname,{},function(err,files) {

    async.map(files,function(file,callback){
        var package_file = path.resolve(__dirname,path.join(file,"package.json"));
        fs.exists(package_file,function (exists){
            if (exists) {
                //xx console.log(package_file);

                var package_ = JSON.parse(fs.readFileSync(package_file));
                ///console.log(package_);
                if (package_.dependencies) {
                    Object.keys(package_.dependencies).map(d => dependencies.push("  " +q(file)+" -> "+q(d) + ";"));
                }
                if (package_.devDependencies) {
                    Object.keys(package_.devDependencies).map(d => dependencies.push("  " +q(file)+" -> "+q(d) + " [color=red,penwidth=3] ;" ));
                }
            }
            callback();
        });

    },function done(err) {
        dependencies = dependencies.filter(a=>!a.match(/^node-opcua/)).map(function(a){ return a.replace(/node-opcua-/g,""); });
        dependencies = dependencies.sort();

        var content = "digraph G {\n";
        content += dependencies.join("\n");
        content += "}";

        // now remove transitive edge
        tred(content,function(err,output){
            fs.writeFile("_tmp.dot",output,function(err){

            });
            dot(output,function(err){

            });
        });

    });
});
