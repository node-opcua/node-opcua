"use strict";
const fs = require("fs");
const path = require("path");
const async = require("async");
const child_process = require("child_process");

function dot(graph, callback) {
    const cmd = "dot -Tpng -o_tmp.png";
    const child = child_process.exec(cmd, function (err) {});
    child.stdin.write(graph);
    child.stdin.end();
    child.stderr.pipe(process.stdout);
    child.on("close", function (code) {
        callback(null);
    });
}

function tred(inputfile, callback) {
    const cmd = "tred";
    const child = child_process.exec(cmd, function (err) {});

    child.stdin.write(inputfile);
    child.stdin.end();

    child.stderr.pipe(process.stdout);

    const result = "";
    child.stdout.on("data", function (data) {
        result += data.toString();
    });
    child.on("close", function () {
        console.log("done ... (" + ")");
        callback(null, result);
    });
}
function q(a) {
    return '"' + a + '"';
}

function collectDeps(map, attr) {
    Object.keys(map)
        .filter((a) => a.match(/node-opcua/))
        .forEach((d) => dependencies.push("  " + q(file) + " -> " + q(d) + " " + attr + ";"));
}

const dependencies = [];
fs.readdir(__dirname, {}, function (err, files) {
    async.map(
        files,
        function (file, callback) {
            const package_file = path.resolve(__dirname, path.join(file, "package.json"));
            if (fs.existsSync(package_file)) {
                const package_ = JSON.parse(fs.readFileSync(package_file));
                if (package_.dependencies) {
                    collectDeps(package_.dependencies, "");
                }
                if (package_.devDependencies) {
                    // collectDeps(package_.devDependencies,"[color=red,penwidth=3]");
                }
                callback();
            }
        },
        function done(err) {
            dependencies = dependencies
                .filter((a) => !a.match(/^node-opcua/))
                .map(
                    (a) => a // a.replace(/node-opcua-/g,"")
                );
            dependencies = dependencies.sort();

            constcontent = "digraph G {\n";
            content += dependencies.join("\n");
            content += "}";

            // now remove transitive edge
            tred(content, function (err, output) {
                fs.writeFile("_tmp.dot", output, function (err) {});
                dot(output, function (err) {});
            });
        }
    );
});
