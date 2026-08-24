import fs from "node:fs";
import path from "node:path";
import { cleanUpTypescriptModule } from "../source/remove_unused";

async function main() {
    const d = await fs.promises.readdir("..");
    for (const f of d) {
        if (f.match(/node-opcua-nodeset-.*/)) {
            console.log(f);
            const fullPath = path.join("..", f);
            try {
                await cleanUpTypescriptModule(fullPath);
            } catch (err) {
                console.log((err as Error).message);
            }
        }
    }
    //
    cleanUpTypescriptModule("../node-opcua-units");
}

main();
