"use strict";
const fs = require("fs");
const path = require("path");
const async = require("async");
const child_process = require("child_process");

const packages_folder = path.join(__dirname, "../packages");
const licence_file = path.join(__dirname, "../LICENSE");
const main_packagejson = path.join(__dirname, "../package.json");
let licence_text = "";
let main_package = {};

async function do_on_folder2(folder, packagejson) {
    const moduleFolder = path.join(packages_folder, folder);
    const local_license_file = path.resolve(path.join(moduleFolder, "LICENSE"));
    console.log("package", packagejson);

    let local_package = JSON.parse(await fs.promises.readFile(packagejson, "utf-8"));
    local_package.description = main_package.description + " - module " + folder.replace("node-opcua-", "");
    local_package.author = main_package.author;
    local_package.license = main_package.license;
    local_package.repository = main_package.repository;
    local_package.keywords = main_package.keywords;
    local_package.homepage = main_package.homepage;

    console.log(" local_package.description= ", local_package.description);

    const f = [];
    [
        "dist",
        "distHelpers",
        "distNodeJS",
        "source",
        "source_nodejs",
        "src",
        "nodeJS.d.ts",
        "nodeJS.js",
        "testHelpers.js",
        "testHelpers.d.ts",
        "nodesets"
    ].forEach((a) => {
        if (fs.existsSync(path.join(moduleFolder, a))) {
            f.push(a);
        }
    });

    local_package.files = [...new Set([...(local_package.files || []), ...f])];
    console.log(local_package.files);

    await fs.promises.writeFile(packagejson, JSON.stringify(local_package, null, "    ")+"\n", "utf-8");
    // await fs.promises.writeFile(local_license_file,licence_text,"utf-8");
}

async function do_on_folder(folder) {
    const package_file = path.resolve(path.join(packages_folder, folder, "package.json"));

    if (fs.existsSync(package_file)) {
        return await do_on_folder2(folder, package_file);
    }
}

async function main() {
    console.log("licence_file = ", licence_file);
    licence_text = await fs.promises.readFile(licence_file, "utf-8");

    console.log("main_packagejson = ", main_packagejson);
    main_package = JSON.parse(await fs.promises.readFile(main_packagejson, "utf-8"));

    const files = await fs.promises.readdir(packages_folder, {});

    for (const file of files) {
        await do_on_folder(file);
    }
    console.log("done");
}
main();
