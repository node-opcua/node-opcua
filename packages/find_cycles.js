const fs = require("node:fs");
const path = require("node:path");
const child_process = require("node:child_process");

function dot(graph) {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn("dot", ["-Tpng", "-o_tmp.png"]);
        child.stdin.write(graph);
        child.stdin.end();
        child.stderr.pipe(process.stdout);
        child.on("close", () => resolve());
        child.on("error", (err) => {
            console.error("dot error:", err.message);
            reject(err);
        });
    });
}

function tred(inputfile) {
    return new Promise((resolve, reject) => {
        const child = child_process.spawn("tred");
        child.stdin.write(inputfile);
        child.stdin.end();
        child.stderr.pipe(process.stdout);

        let result = "";
        child.stdout.on("data", (data) => {
            result += data.toString();
        });
        child.on("close", () => {
            console.log("done ...");
            resolve(result);
        });
        child.on("error", (err) => {
            console.error("tred error:", err.message);
            reject(err);
        });
    });
}

function q(a) {
    return `"${a}"`;
}

function collectDeps(file, map, attr) {
    return Object.keys(map)
        .filter((a) => a.match(/node-opcua/))
        .map((d) => `  ${q(file)} -> ${q(d)} ${attr};`);
}

async function main() {
    const files = fs.readdirSync(__dirname);
    let dependencies = [];

    for (const file of files) {
        const packageFile = path.resolve(__dirname, file, "package.json");
        if (!fs.existsSync(packageFile)) continue;

        const pkg = JSON.parse(fs.readFileSync(packageFile, "utf-8"));
        if (pkg.dependencies) {
            dependencies.push(...collectDeps(file, pkg.dependencies, ""));
        }
        // if (pkg.devDependencies) {
        //     dependencies.push(...collectDeps(file, pkg.devDependencies, "[color=red,penwidth=3]"));
        // }
    }

    dependencies = dependencies
        .filter((a) => !a.match(/^node-opcua/))
        .sort();

    let content = "digraph G {\n";
    content += dependencies.join("\n");
    content += "}";

    // remove transitive edges
    const output = await tred(content);
    fs.writeFileSync("_tmp.dot", output);
    await dot(output);
}

main().catch((err) => {
    console.error("find_cycles failed:", err.message);
    process.exitCode = 1;
});
