"use strict";
const fs = require("fs");
const path = require("path");
const async = require("async");
const child_process = require("child_process");

function dot(graph, callback) {
    const child = child_process.spawn("dot", ["-Tpng", "-o_tmp.png"]);
    child.stdin.write(graph);
    child.stdin.end();
    child.stderr.pipe(process.stdout);
    child.on("close", function (code) {
        callback(null);
    });
    child.on("error", function (err) {
        console.error("dot error:", err.message);
        callback(err);
    });
}

function tred(inputfile, callback) {
    const child = child_process.spawn("tred");

    child.stdin.write(inputfile);
    child.stdin.end();

    child.stderr.pipe(process.stdout);

    let result = "";
    child.stdout.on("data", function (data) {
        result += data.toString();
    });
    child.on("close", function () {
        console.log("done ... (" + ")");
        callback(null, result);
    });
    child.on("error", function (err) {
        console.error("tred error:", err.message);
        callback(err);
    });
}
function q(a) {
    return '"' + a + '"';
}

let dependencies = [];

function collectDeps(file, map, attr) {
    Object.keys(map)
        .filter((a) => a.match(/node-opcua/))
        .forEach((d) => dependencies.push("  " + q(file) + " -> " + q(d) + " " + attr + ";"));
}

fs.readdir(__dirname, {}, function (err, files) {
    async.map(
        files,
        function (file, callback) {
            const package_file = path.resolve(__dirname, path.join(file, "package.json"));
            if (fs.existsSync(package_file)) {
                const package_ = JSON.parse(fs.readFileSync(package_file));
                if (package_.dependencies) {
                    collectDeps(file, package_.dependencies, "");
                }
                if (package_.devDependencies) {
                    // collectDeps(file, package_.devDependencies,"[color=red,penwidth=3]");
                }
                callback();
            } else {
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

            let content = "digraph G {\n";
            content += dependencies.join("\n");
            content += "}";

            // now remove transitive edge
            tred(content, function (err, output) {
                if (err) return;
                fs.writeFile("_tmp.dot", output, function (err) {});
                dot(output, function (err) {});
            });
        }
    );
});
