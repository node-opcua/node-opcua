/* eslint-disable max-statements */
import path from "path";
import fs from "fs";

import { IBasicSessionAsync } from "node-opcua-pseudo-session";
import { DataTypeIds } from "node-opcua-constants";
import { ReferenceDescriptionEx, walkThroughDataTypes, walkThroughObjectTypes, walkThroughVariableTypes } from "./walk_through";
import { convertTypeToTypescript } from "./convert_to_typescript";
import { constructCache } from "./private/cache";
import { writeFileSyncRetry } from "./private/fs_retry";
import { Options } from "./options";

function findPackageJson(dependency: string, options: Options): string | undefined {
    const l = [...(options.lookupFolders || [])];
    l.push(path.join(__dirname, "../../"));
    for (const folder of l) {
        const d = path.join(folder, dependency + "/package.json");
        if (!fs.existsSync(d)) {
            continue;
        }
        return d;
    }
    return undefined;
}

function getPackageFolder(dependency: string, options: Options) {
    const found = findPackageJson(dependency, options);
    if (found) {
        return found;
    }
    //
    console.log("cannot find package.json for ", dependency, " : creating it");
    const packageoFolder = path.join(__dirname, "../../", dependency);
    if (!fs.existsSync(packageoFolder)) {
        fs.mkdirSync(packageoFolder);
    }
    const packageJson = path.join(packageoFolder, "package.json");
    if (!fs.existsSync(packageJson)) {
        fs.writeFileSync(packageJson, "{\n  \"name\": \"" + dependency + "\"\n}");
    }
    const sourceFolder = path.join(packageoFolder, "source");
    if (!fs.existsSync(sourceFolder)) {
        fs.mkdirSync(sourceFolder);
    }
    return packageJson;


    throw new Error("cannot find package.json for " + dependency);
}
function getPackageInfo(dependency: string, options: Options) {
    const d = getPackageFolder(dependency, options);
    const p = JSON.parse(fs.readFileSync(d, "utf8"));
    return p;
}

// The version stamped on a generated package is, in order of preference:
//
//  1. the version the package already carries. Regenerating is not a release: the
//     bumping is lerna's job, and lerna only bumps what it considers changed. If
//     generation re-stamped every package with the monorepo release version, every
//     regeneration would move packages lerna deliberately left behind, and the
//     dependants still pinning the older version would fail `pnpm run consistency`.
//  2. for a brand new package (nothing on disk yet), the current version of
//     node-opcua-address-space, so it enters the workspace in step with the SDK.
//  3. the monorepo release version, when even that is not resolvable.
function getGeneratedPackageVersion(info: Info, options: Options): string {
    const packagejson = path.join(info.folder, "package.json");
    if (fs.existsSync(packagejson)) {
        try {
            const { version } = JSON.parse(fs.readFileSync(packagejson, "utf8"));
            if (version) {
                return version;
            }
        } catch (err) {
            // malformed package.json: fall through and seed a fresh version
        }
    }
    const seed = findPackageJson("node-opcua-address-space", options);
    if (seed) {
        const { version } = JSON.parse(fs.readFileSync(seed, "utf8"));
        if (version) {
            return version;
        }
    }
    return getReleaseVersion(options);
}

// Monorepo release version (lerna.json), used only to seed a package that has no
// version of its own yet.
function getReleaseVersion(options: Options): string {
    let folder = __dirname;
    for (let i = 0; i < 6; i++) {
        if (path.basename(folder) === "node_modules") {
            // installed as a dependency: the lerna.json above us belongs to someone else.
            break;
        }
        const lernaJson = path.join(folder, "lerna.json");
        if (fs.existsSync(lernaJson)) {
            const { version } = JSON.parse(fs.readFileSync(lernaJson, "utf8"));
            if (version) {
                return version;
            }
        }
        const parent = path.dirname(folder);
        if (parent === folder) {
            break;
        }
        folder = parent;
    }
    // standalone use (the tool installed from npm): fall back on the SDK version.
    const base = findPackageJson("node-opcua-address-space-base", options);
    const version = base ? JSON.parse(fs.readFileSync(base, "utf8")).version : undefined;
    if (!version) {
        throw new Error("cannot determine a version to stamp on the generated packages");
    }
    return version;
}

interface Info {
    files: string[];
    folder: string;
    module: string;
    dependencies: string[];
}
export async function convertNamespaceTypeToTypescript(
    session: IBasicSessionAsync,
    namespaceIndex: number,
    options: Options
): Promise<void> {
    if (namespaceIndex < 0) {
        throw new Error("namespaceIndex cannot be negative");
    }
    const cache = await constructCache(session, options);

    if (!fs.existsSync(options.baseFolder)) {
        fs.mkdirSync(options.baseFolder);
    }

    const infos: { [key: string]: Info } = {};
    // walk through all Types:
    const nodeVisitor = {
        async visit(reference: ReferenceDescriptionEx, level: number): Promise<void> {
            if (reference.nodeId.namespace !== namespaceIndex) {
                return;
            }
            cache!.resetRequire();

            if (reference.nodeId.namespace === 0 && reference.nodeId.value === DataTypeIds.Enumeration) {
                return; // ignore enumeration
            }
            const { type, content, folder, module, filename, dependencies } = await convertTypeToTypescript(
                session,
                reference.nodeId,
                options,
                cache!
            );

            if (type === "basic") {
                return;
            }

            const _f = path.dirname(folder);
            if (!fs.existsSync(_f)) {
                fs.mkdirSync(_f);
            }
            if (!fs.existsSync(folder)) {
                fs.mkdirSync(folder);
            }
            const sourceFolder = path.join(folder, "source");
            if (!fs.existsSync(sourceFolder)) {
                fs.mkdirSync(sourceFolder);
            }
            writeFileSyncRetry(path.join(sourceFolder, filename + ".ts"), content);
            infos[module] = infos[module] || { folder, dependencies: [], module, files: [] };
            infos[module].files.push(filename + ".ts");
            infos[module].dependencies = [...new Set([...infos[module].dependencies, ...dependencies])];
        }
    };

    await walkThroughObjectTypes(session, nodeVisitor);
    await walkThroughVariableTypes(session, nodeVisitor);
    await walkThroughDataTypes(session, nodeVisitor);

    await outputFiles(infos, options);
}

async function _output_index_ts_file(info: Info): Promise<void> {
    const index = path.join(info.folder, "source/index.ts");
    const content: string[] = [];
    for (const file of info.files.sort()) {
        if (file.match(/^ua_property/)) {
            continue;
        }
        if (file.match(/^enum_eration/)) {
            continue;
        }
        content.push(`export * from "./${file.replace(".ts", "")}";`);
    }
    fs.writeFileSync(index, content.join("\n"));
    // create package.json
}
async function _output_package_json(info: Info, options: Options): Promise<void> {
    const packagejson = path.join(info.folder, "package.json");
    const version = getGeneratedPackageVersion(info, options);

    const content2: string[] = [];
    content2.push(`{`);
    content2.push(`    "name": "${info.module}",`);
    content2.push(`    "version": "${version}",`);
    content2.push(`    "description": "pure nodejs OPCUA SDK - module ${info.module}",`);
    content2.push(`    "main": "dist/index.js",`);
    content2.push(`    "types": "dist/index.d.ts",`);
    content2.push(`    "scripts": {`);
    content2.push(`        "clean": "npx rimraf -g  dist *.tsbuildinfo",`);
    content2.push(`        "build": "tsc -b"`);
    content2.push(`    },`);
    content2.push(`    "author": "Etienne Rossignon <etienne.rossignon@sterfive.com>",`);
    content2.push(`    "license": "MIT",`);

    content2.push(`    "dependencies": {`);
    // find versions
    const versions: { [key: string]: string } = {};
    for (const dependency of info.dependencies) {
        const p = await getPackageInfo(dependency, options);
        versions[dependency] = p.version;
    }
    content2.push(
        info.dependencies
            .sort()
            .map((d) => `        "${d}": "${versions[d]}"`)
            // .map((d) => `        "${d}": "file:../${d}"`)
            .join(",\n")
    );
    content2.push(`    },`);
    content2.push(`    "files": [`);
    content2.push(`        "dist",`);
    content2.push(`        "source"`);
    content2.push(`    ],`);

    content2.push(`    "repository": {`);
    content2.push(`        "type": "git",`);
    content2.push(`        "url": "git://github.com/node-opcua/node-opcua.git"`);
    content2.push(`    },`);
    content2.push(`    "keywords": [`);
    content2.push(`        "OPCUA",`);
    content2.push(`        "opcua",`);
    content2.push(`        "m2m",`);
    content2.push(`        "iot",`);
    content2.push(`        "opc ua",`);
    content2.push(`        "internet of things"`);
    content2.push(`    ],`);
    content2.push(`    "homepage": "http://node-opcua.github.io/"`);
    content2.push(`}`);
    content2.push(``);

    fs.writeFileSync(packagejson, content2.join("\n"));
}
async function _output_tsconfig_json(info: Info, options: Options): Promise<void> {
    const tsconfig = path.join(info.folder, "tsconfig.json");
    const content3: string[] = [];
    content3.push(`{`);

    content3.push(`  "extends": "../tsconfig.common.json",`);
    content3.push(`  "compilerOptions": {`);
    content3.push(`        "rootDir": "source",`);
    content3.push(`        "outDir": "dist",`);
    content3.push(`        "composite": true`);
    content3.push(`   },`);
    content3.push(`   "include": [`);
    content3.push(`        "source/*.ts",`);
    content3.push(`   ],`);
    content3.push(`   "references": [`);
    // content3.push(`      { "path": "../node-opcua-address-space-base" }`);
    const l = [] as string[];
    for (const dep of info.dependencies) {
        // only add in dep if not found in node_module
        if (!isIn_node_modules_Folder(dep)) {
            l.push(`     { "path": "../${dep}" }`);
        }
    }
    content3.push(l.join(",\n"));
    content3.push(`   ],`);
    content3.push(`   "exclude": [`);
    content3.push(`     "node_modules",`);
    content3.push(`     "dist"`);
    content3.push(`   ]`);
    content3.push(`}`);

    fs.writeFileSync(tsconfig, content3.join("\n"));

    function isIn_node_modules_Folder(dep: string) {
        const c = getPackageFolder(dep, options);
        return !!c.match(/node_modules/);
    }
}
async function _output_licence(info: Info, options: Options): Promise<void> {

    if (info.module === "node-opcua-nodeset-ua") {
        return;
    }
    const licenseFile = path.join(info.folder, "LICENSE");

    const content3: string[] = [];
    content3.push(``);
    const year = new Date().getFullYear();
    content3.push(`The MIT License (MIT)

Copyright (c) 2022-${year}  Sterfive SAS - 833264583 RCS ORLEANS - France (https://www.sterfive.com)

Copyright (c) 2014-2022 Etienne Rossignon

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`);


    // content3.push(fs.readFileSync(path.join(__dirname, "../source/licences/agpl_v3.md"), "utf8"));
    fs.writeFileSync(licenseFile, content3.join("\n"));



}
async function outputFiles(infos: { [key: string]: Info }, options: Options) {
    const values = Object.values(infos) as Info[];
    if (values.length < 1) {
        console.log(`There is no type information to generate for ${options.nsName}`)
    }
    console.log("generating files for ", options.nsName);
    for (const info of values) {
        await _output_index_ts_file(info);
        await _output_package_json(info, options);
        await _output_tsconfig_json(info, options);
        await _output_licence(info, options);
    }
    // Import cleanup is deferred to a second, parallel phase in main.ts —
    // each namespace's cleanup uses an isolated ts-morph Project, so the
    // expensive AST work can run across many cores without contention.
}
