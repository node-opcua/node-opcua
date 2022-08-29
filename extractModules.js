const fs = require("fs");
const { assert } = require("console");
const path = require("path");
const ts = require("typescript");
const chalk = require("chalk");

function isNodeJSModule(m) {
    return ["util", "fs", "crypto", "path", "events", "http", "net", "os", "dns", "child_process", "url"].indexOf(m) !== -1;
}
function isRelativeModule(m) {
    return m[0] === ".";
}
function isExternalModule(m) {
    return !isNodeJSModule(m) && !isRelativeModule(m);
}
function getModuleName(str) {
    if (str[0] === "@") {
        return str.split("/").slice(2).join("/");
    }
    return str.split("/")[0];
}
assert(getModuleName("@types/node") === "@types/node");
assert(getModuleName("@types/node/other") === "@types/node");
assert(getModuleName("a/b") === "a");

async function exploreSourceFile(filename) {
    const filename1 = path.basename(filename);
    const node = ts.createSourceFile(
        filename1, // fileName
        fs.readFileSync(filename, "utf8"), // sourceText
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
        }
        if (child.kind === ts.SyntaxKind.ImportDeclaration) {
            if (!child.moduleSpecifier || !child.moduleSpecifier.text) {
                console.log("filename1 = ", filename1);
                console.log(child);
                process.exit(0);
            }
            // console.log("found (ts) ", child.moduleSpecifier.text);
            const moduleName = getModuleName(child.moduleSpecifier?.text);
            if (isExternalModule(moduleName)) {
                modules.push(moduleName);
            }
        }
        if (child.kind === ts.SyntaxKind.FirstStatement) {
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
        if (d.name === "src" || d.name.match(/^source/)) {
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

    function extractMissingAndExtra(bucket, dependencies) {
        const expectedDependencies = new Set(bucket.modules);
        const actualDependencies = new Set(Object.keys(dependencies || {}));
        const missing = [...expectedDependencies].filter((d) => !actualDependencies.has(d));
        const extra = [...actualDependencies].filter((d) => !expectedDependencies.has(d));
        console.log("missing", chalk.cyan(missing.join(" ")));
        console.log("extra  ", chalk.yellow(extra.join(" ")));
        return { missing, extra };
    }
    {
        fixArrobasTypeDefinition(bucketDependencies, packageJson.dependencies);
        const { missing, extra } = extractMissingAndExtra(bucketDependencies, packageJson.dependencies);
        console.log("------");
    }
    {
        fixArrobasTypeDefinition(bucketDevDependencies, packageJson.devDependencies);
        const { missing, extra } = extractMissingAndExtra(bucketDevDependencies, packageJson.devDependencies);
        console.log("------");
    }
    console.log("");

    addDependencies(packageName, [...bucketDependencies.modules, ...bucketDevDependencies.modules]);
}
(async () => {
    const folder = path.join(__dirname, "packages");
    const filesAndFolder = await fs.promises.readdir(folder, { withFileTypes: true });
    for (const d of filesAndFolder) {
        if (d.isDirectory()) {
            await analyzePackageFolder(path.join(folder, d.name), d.name);
        }
    }

    for (const m of Object.keys(_graph)) {
        verifyCycle(m);
    }
    // console.log(_graph);
})();

//exploreSourceFile("toto.ts");
