
import * as fs from "fs";
import * as path from "path";

const readdir = fs.promises.readdir;
const readFileSync = fs.promises.readFile;
(async () => {

    try {
        const files = (await readdir(path.join(__dirname, "/"))).filter((f) => f.match(/node-opcua/));

        for (const file of files) {
            console.log("f=", file);
            const package_json = path.join(__dirname, file + "/package.json");
            const tsconfigFile = path.join(__dirname, file + "/tsconfig.json");

            const t = await fs.promises.readFile(package_json, "utf-8");
            const p = JSON.parse(t);

            const dep: string[] = Object.keys(p.dependencies || {}) || [];
            const devDep: string[] = Object.keys(p.devDependencies || {}) || [];
            const dependencies = dep.concat(devDep);
            console.log("dep=", dependencies);
            const ts = await fs.promises.readFile(tsconfigFile, "utf-8");
            const tsconfig = JSON.parse(ts);

            tsconfig.compilerOptions.composite = true;
            if (dep) {
                tsconfig.references = [];
                for (const d of dependencies) {
                    if (!d.match(/node-opcua/)) {
                        continue;
                    }
                    if (d.match(/node-opcua-pki/) || d.match(/node-opcua-crypto/)) {
                        continue;
                    }
                    tsconfig.references.push({
                        path: "../" + d
                    });
                }
            }
            tsconfig.exclude = tsconfig.exclude || ["node_modules", "dist"];
            console.log("          ", tsconfig.exclude.join(" "))
            const str = JSON.stringify(tsconfig, null, "  ");
            await fs.promises.writeFile(tsconfigFile, str, "utf-8");
        }

    } catch (err) {
        console.log(err);
    }
})();