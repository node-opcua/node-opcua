/* eslint-disable complexity */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const chalk = require("chalk");

function isNodeJSModule(m) {
    return (
        [
            "assert",
            "child_process",
            "crypto",
            "dns",
            "events",
            "fs",
            "http",
            "net",
            "os",
            "path",
            "stream",
            "timers",
            "url",
            "util",
        ].indexOf(m) !== -1
    );
}
function isRelativeModule(m) {
    return m[0] === ".";
}
function isExternalModule(m) {
    return !isNodeJSModule(m) && !isRelativeModule(m);
}
function getModuleName(str) {
    if (str[0] === "@") {
        return str.split("/").slice(0, 2).join("/");
    }
    return str.split("/")[0];
}
function test(input, expected) {
    const actual = getModuleName(input);
    if (actual !== expected) {
        throw new Error(`expecting getModuleName("${input}") == "${expected}" but got "${actual}"`);
    }
}
test("@types/node", "@types/node");
test("@types/node/other", "@types/node");
test("a/b", "a");
test("@sterfive/abcdef", "@sterfive/abcdef");

async function exploreSourceFile(filename) {
    const filename1 = path.basename(filename);
    const source = fs.readFileSync(filename, "utf8"); // sourceText
    return exploreSourceFileInner(source, filename1);
}

async function exploreSourceFileInner(source, filename1) {
    const node = ts.createSourceFile(
        filename1, // fileName
        source,
        ts.ScriptTarget.Latest // langugeVersion
    );
    // console.log("filename", filename);

    const modules = [];
    node.forEachChild((child) => {
        // console.log(ts.SyntaxKind[child.kind]);
        if (child.kind === ts.SyntaxKind.ExportDeclaration) {
            if (!child.moduleSpecifier || !child.moduleSpecifier.text) {
                console.log("filename1 = ", filename1);
                console.log(child);
                process.exit(0);
            }
            const moduleName = getModuleName(child.moduleSpecifier.text);
            if (isExternalModule(moduleName)) {
                modules.push(moduleName);
            }
        } else if (child.kind === ts.SyntaxKind.ImportDeclaration) {
            if (!child.moduleSpecifier || !child.moduleSpecifier.text) {
                console.log("filename1 = ", filename1);
                console.log(child);
            }
            // console.log("found (ts) ", child.moduleSpecifier.text);
            const moduleName = getModuleName(child.moduleSpecifier?.text);
            if (isExternalModule(moduleName)) {
                modules.push(moduleName);
            }
        } else if (child.kind === ts.SyntaxKind.FirstStatement) {
            // console.log(" ", child.declarationList.declarations);
            const s = child.declarationList.declarations[0];
            if (s.initializer?.kind === ts.SyntaxKind.PropertyAccessExpression) {
                // detecting   const a = require("B").c;
                const e = s.initializer.expression;
                if (e.kind === ts.SyntaxKind.CallExpression) {
                    if (e.expression.escapedText === "require") {
                        const moduleName = getModuleName(e.arguments[0]?.text);
                        // console.log("found (js) ", s.initializer.arguments[0]?.text, moduleName);
                        if (isExternalModule(moduleName)) {
                            modules.push(moduleName);
                        }
                    }
                }
            } else if (s.initializer?.kind === ts.SyntaxKind.CallExpression) {
                // detecting   const a = require("B");
                if (s.initializer?.expression?.escapedText === "require") {
                    const moduleName = getModuleName(s.initializer.arguments[0]?.text);
                    // console.log("found (js) ", s.initializer.arguments[0]?.text, moduleName);
                    if (isExternalModule(moduleName)) {
                        modules.push(moduleName);
                    }
                }
            }
        } else if (child.kind === ts.SyntaxKind.ExpressionStatement) {
            if (child.expression.kind === ts.SyntaxKind.CallExpression) {
                if (child.expression.expression.escapedText === "require") {
                    const m = child.expression.arguments[0].text;
                    const moduleName = getModuleName(m);
                    // console.log("found (js) ", s.initializer.arguments[0]?.text, moduleName);
                    if (isExternalModule(moduleName)) {
                        modules.push(moduleName);
                    }
                }
            }
        } else if (child.kind === ts.SyntaxKind.ImportEqualsDeclaration) {
            // import envpath = require("env-path");
            const moduleName = getModuleName(child.name.escapedText);
            if (isExternalModule(moduleName)) {
                modules.push(moduleName);
            }
        }
    });
    return [...new Set(modules).values()].sort();
}
async function onAllSource(folder, bucket, options) {
    const recursive = !options || options.recursive;

    const filesAndFolder = await fs.promises.readdir(folder, { withFileTypes: true });
    for (const d of filesAndFolder) {
        const fullPathName = path.join(folder, d.name);
        if (d.isSymbolicLink()) {
            //xx console.log("ignoring symbolic link", fullPathName);
        } else if (d.isDirectory()) {
            recursive && (await onAllSource(fullPathName, bucket));
        } else {
            const e = path.extname(d.name);
            if (e === ".js" || e === ".ts") {
                const modules = await exploreSourceFile(fullPathName);
                //xx console.log("modules ", modules.join(" "));
                bucket.modules = [...new Set(bucket.modules.concat(modules)).values()].sort();
            }
        }
    }
}
async function onModule(folder, bucketDependencies, bucketDevDependencies) {
    const { sourceFolders, devFolders, ignoreFolders, unknownFolders } = await extractSourceAndDevFolders(folder);
    // console.log({ sourceFolders, devFolders, ignoreFolders, unknownFolders });
    for (const f of sourceFolders) {
        await onAllSource(path.join(folder, f), bucketDependencies);
    }
    await onAllSource(folder, bucketDependencies, { recursive: false });

    for (const f of devFolders) {
        await onAllSource(path.join(folder, f), bucketDevDependencies);
    }

    // make sure that bucketDevDependencies do not have modules already required by bucketDependencies
    const m = new Set(bucketDependencies.modules);
    bucketDevDependencies.modules = bucketDevDependencies.modules.filter((a) => !m.has(a));

    unknownFolders.length && console.log("unknownFolder : ", unknownFolders.join(" "));
}

/**
 * @type {[key:string]: string[]}
 */
const _graph = {};
/**
 *
 * @param {string} parent
 * @param {string[]} children
 */
function addDependencies(parent, children) {
    if (_graph[parent]) {
        throw new Error("parent already inserted");
    }
    _graph[parent] = children;
}
/**
 *
 * @param {string} parent
 */
function verifyCycle(parent) {


    let cycleCount  = 0;
    const m = new Set();
    /**
     * @type string[]
     */
    const p = _graph[parent];

    const cur = p;

    function visit(cur, m, path) {
        for (const child of cur) {
            const c = _graph[child];
            // not visited yet
            if (!c) {
                continue;
            }

            if (m.has(child)) continue;

            const ind = c.indexOf(parent);

            if (ind >= 0) {
                cycleCount++;
                console.log("Found cycle ", path, " => ", child);
                // console.log("child ", child,c);
                // console.log()
                return;
            }
            if (!m.has(child)) {
                m.add(child);
                visit(c, m, path + " => " + child);
            }
        }
    }
    visit(cur, m, parent);

    return cycleCount;
}
async function extractSourceAndDevFolders(folder) {
    const sourceFolders = [];
    const devFolders = [];
    const ignoreFolders = [];
    const unknownFolders = [];
    const filesAndFolder = await fs.promises.readdir(folder, { withFileTypes: true });
    for (const d of filesAndFolder) {
        if (!d.isDirectory()) continue;
        if (d.name === "dist" || d.name === "node_modules" || d.name.match(/^dist/)) {
            ignoreFolders.push(d.name);
            continue;
        }
        if (d.name === "src" || d.name.match(/^source/) || d.name === "bin") {
            sourceFolders.push(d.name);
            continue;
        }
        if (d.name.match(/test/) || d.name.match(/fixture/)) {
            devFolders.push(d.name);
            continue;
        }
        unknownFolders.push(d.name);
    }
    return { sourceFolders, devFolders, ignoreFolders, unknownFolders };
}
async function analyzePackageFolder(folder, packageName) {
    const packageJsonFile = path.join(folder, "package.json");
    if (!fs.existsSync(packageJsonFile)) {
        return;
        // not a module
    }

    const packageJson = JSON.parse(await fs.promises.readFile(packageJsonFile, "utf-8"));

    console.log(" -------------> ", folder);

    const bucketDependencies = { modules: [] };
    const bucketDevDependencies = { modules: [] };
    await onModule(folder, bucketDependencies, bucketDevDependencies);
    if (false) {
        console.log(bucketDependencies);
        console.log(bucketDevDependencies);
    }
    // now compare with what is in package .json

    function fixArrobasTypeDefinition(bucket, dependencies) {
        const dep = Object.keys(dependencies || {});
        const arrobasType = dep.filter((m) => !!m.match(/@types/)).map((x) => x.replace("@types/", ""));
        if (arrobasType.length) {
            console.log(chalk.yellow("arrobasType"), arrobasType);
        }
        const m = new Set(Object.keys(dependencies || {}));
        const extraArrobas = arrobasType.filter((d) => !m.has(d));
        if (extraArrobas.length) {
            console.log(chalk.green("unnecessary types="), extraArrobas.join(" "));
        }
        for (const k of dep.filter((m) => m.match(/@types/))) {
            delete dependencies[k];
        }
    }

    function extractMissingAndExtra(title, bucket, dependencies) {
        const expectedDependencies = new Set(bucket.modules);
        const actualDependencies = new Set(Object.keys(dependencies || {}));
        const missing = [...expectedDependencies].filter((d) => !actualDependencies.has(d));
        const extra = [...actualDependencies].filter((d) => !expectedDependencies.has(d));

        if (missing.length || extra.length) {
            const msg =
                title.padEnd(15, " ") +
                " missing :" +
                chalk.cyan(missing.join(" ")) +
                "\n" +
                title.padEnd(15, " ") +
                " extra   :" +
                chalk.yellow(extra.join(" "));
            console.log(msg);
            console.log("------");
        }
        return { missing, extra };
    }
    {
        fixArrobasTypeDefinition(bucketDependencies, packageJson.dependencies);
        const { missing, extra } = extractMissingAndExtra("dependencies", bucketDependencies, packageJson.dependencies);
    }
    {
        fixArrobasTypeDefinition(bucketDevDependencies, packageJson.devDependencies);
        const { missing, extra } = extractMissingAndExtra("devDependencies", bucketDevDependencies, packageJson.devDependencies);
    }
    addDependencies(packageName, [...bucketDependencies.modules, ...bucketDevDependencies.modules]);
}

async function main() {
    const folder = path.join(__dirname, "packages");
    const filesAndFolder = await fs.promises.readdir(folder, { withFileTypes: true });
    for (const d of filesAndFolder) {
        if (d.isDirectory()) {
            await analyzePackageFolder(path.join(folder, d.name), d.name);
        }
    }

    let cycleCount = 0;
    for (const m of Object.keys(_graph)) {
        cycleCount += verifyCycle(m);
    }
    console.log(cycleCount? chalk.red(`${cycleCount} cycles have been found !`) : chalk.green("OK"));
    // console.log(_graph);
}

async function test2() {
    const source = `
import sinon = require("sinon");
import * as foo from "foo1";
import * as path from "path";
const a = require("foo2");
const b = require("foo3/folder");
const c = require("@foo4/foo4");
export { a } from "foo5";
export *  from "foo6";
import { a, b } from "..";
import { v } from "../foo7";

    `;

    const actual = (await exploreSourceFileInner(source, "foo")).join(" - ");
    const expected = "@foo4/foo4 - foo1 - foo2 - foo3 - foo5 - foo6 - sinon";

    if (actual !== expected) {
        throw new Error(`expecting  "${expected}" but got "${actual}"`);
    }
}
test2();
main();
