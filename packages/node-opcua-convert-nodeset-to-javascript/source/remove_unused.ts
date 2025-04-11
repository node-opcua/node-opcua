import { Project, SourceFile } from "ts-morph";
import fs from "fs";
import path from "path";

import ts from "typescript";

const dryRun = false;
function fixFile(file: SourceFile) {
    // Remove unused imports
    file.getImportDeclarations().forEach((importDecl) => {
        const namedImports = importDecl.getNamedImports();
        const usedNamedImports = namedImports.filter((namedImport) => {
            const name = namedImport.getNameNode().getText();
            return file.getDescendantsOfKind(ts.SyntaxKind.Identifier)
                .some(id => id.getText() === name && id !== namedImport.getNameNode());
        });

        // If none are used, remove whole import
        if (usedNamedImports.length === 0) {
            console.log("removing wholee import", importDecl.getFullText());
            importDecl.remove();
        } else if (usedNamedImports.length < namedImports.length) {
            // Remove only unused named imports
            namedImports.forEach(named => {
                if (!usedNamedImports.includes(named)) {

                    console.log("removing name in import ", named);
                    named.remove();
                }
            });
        }
    });

    // Remove unused local variables (function-scope or top-level)
    file.getVariableStatements().forEach(variableStatement => {
        variableStatement.getDeclarations().forEach(declaration => {
            const name = declaration.getName();
            const references = declaration.findReferences();
            const isUsed = references.some(ref => {
                return ref.getReferences().some(r => !r.isDefinition());
            });

            if (!isUsed) {

                console.log(name);
                if (!dryRun)
                    declaration.remove();
            }
        });

        try {
            // If no declarations left in this statement, remove the whole statement
            if (variableStatement.getDeclarations().length === 0) {
                console.log(variableStatement);
                if (!dryRun) {
                    variableStatement.remove();
                }
            }
        } catch (err) {
            console.log((err as Error).message);

        }
    });

    // Save changes
    if (!dryRun) {
        file.saveSync();
    }
}
export async function cleanUpTypescriptModule(moduleFolder: string) {


    const project = new Project({
        tsConfigFilePath: path.join(moduleFolder, "tsconfig.json"), // Optional but recommended
    });

    const sourceFolder = path.join(moduleFolder, "source");

    const dirFiles = await fs.promises.readdir(sourceFolder);
    for (let f of dirFiles) {
        console.log("f= ", f);
        const fullPath = path.join(sourceFolder, f);
        const sourceFile = project.getSourceFileOrThrow(fullPath);
        fixFile(sourceFile);
    }

}


async function main() {

    const d = await fs.promises.readdir("..");
    for (let f of d) {
        if (f.match(/node-opcua-nodeset-.*/)) {
            console.log(f);
            const fullPath = path.join("..", f);
            try {
                await cleanUpTypescriptModule(fullPath);
            }
            catch (err) {
                console.log((err as Error).message);
            }
        }
    }
    //   
    cleanUpTypescriptModule("../node-opcua-units");
}
main()
