import * as path from "path";
import * as fs from "fs";

import { IBasicSession } from "node-opcua-pseudo-session";
import { DataTypeIds } from "node-opcua-constants";
import { ReferenceDescriptionEx, walkThroughDataTypes, walkThroughObjectTypes, walkThroughVariableTypes } from "./walk_through";
import { convertTypeToTypescript } from "./convert_to_typescript";
import { constructCache } from "./private/cache";
import { Options } from "./options";

function getPackageInfo(dependency: string) {
    const d = path.join(__dirname, "../../" + dependency + "/package.json");
    const p = JSON.parse(fs.readFileSync(d, "utf8"));
    return p;
}
interface Info {
    files: string[];
    folder: string;
    module: string;
    dependencies: string[];
}
export async function convertNamespaceTypeToTypescript(
    session: IBasicSession,
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
            fs.writeFileSync(path.join(sourceFolder, filename + ".ts"), content);
            infos[module] = infos[module] || { folder, dependencies: [], module, files: [] };
            infos[module].files.push(filename + ".ts");
            infos[module].dependencies = [...new Set([...infos[module].dependencies, ...dependencies])];
        }
    };

    await walkThroughObjectTypes(session, nodeVisitor);
    await walkThroughVariableTypes(session, nodeVisitor);
    await walkThroughDataTypes(session, nodeVisitor);

    await outputFiles(infos);
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
async function _output_package_json(info: Info): Promise<void> {
    const packagejson = path.join(info.folder, "package.json");
    const version = getPackageInfo("node-opcua-address-space-base").version;

    const content2: string[] = [];
    content2.push(`{`);
    content2.push(`    "name": "${info.module}",`);
    content2.push(`    "version": "${version}",`);
    content2.push(`    "description": "",`);
    content2.push(`    "main": "dist/index.js",`);
    content2.push(`    "types": "dist/index.d.ts",`);
    content2.push(`    "scripts": {`);
    content2.push(`        "build": "tsc -b"`);
    content2.push(`    },`);
    content2.push(`    "author": "etienne.rossignon@sterfive.com",`);
    content2.push(`    "license": "MIT",`);
    content2.push(`    "dependencies": {`);

    // find versions

    const versions: { [key: string]: string } = {};
    for (const dependency of info.dependencies) {
        const p = await getPackageInfo(dependency);
        versions[dependency] = p.version;
    }
    content2.push(
        info.dependencies
            .sort()
            .map((d) => `        "${d}": "${versions[d]}"`)
            .join(",\n")
    );

    content2.push(`    },`);
    content2.push(`    "devDependencies": {}`);
    content2.push(`}`);
    content2.push(``);

    fs.writeFileSync(packagejson, content2.join("\n"));
}
async function _output_tsconfig_json(info: Info): Promise<void> {
    const tsconfig = path.join(info.folder, "tsconfig.json");
    const content3: string[] = [];
    content3.push(`{`);

    content3.push(`  "extends": "../tsconfig.json",`);
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
        l.push(`     { "path": "../${dep}" }`);
    }
    content3.push(l.join(",\n"));
    content3.push(`   ],`);
    content3.push(`   "exclude": [`);
    content3.push(`     "node_modules",`);
    content3.push(`     "dist"`);
    content3.push(`   ]`);
    content3.push(`}`);

    fs.writeFileSync(tsconfig, content3.join("\n"));
}
async function outputFiles(infos: { [key: string]: Info }) {
    for (const info of Object.values(infos) as Info[]) {
        // create indexes
        await _output_index_ts_file(info);

        await _output_package_json(info);

        await _output_tsconfig_json(info);
    }
}
