import fs from "node:fs";
import path from "node:path";

import type { ImportDeclarationStructure, OptionalKind, SourceFile } from "ts-morph";
import { Node, Project, SyntaxKind } from "ts-morph";

const dryRun = false;

const NODE_BUILTINS = new Set([
    "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
    "crypto", "dgram", "dns", "events", "fs", "http", "http2", "https", "net",
    "os", "path", "perf_hooks", "process", "querystring", "readline", "stream",
    "string_decoder", "tls", "tty", "url", "util", "v8", "vm", "worker_threads",
    "zlib",
]);

function importGroup(spec: string): number {
    if (spec.startsWith("node:") || NODE_BUILTINS.has(spec)) return 0;
    if (spec.startsWith(".")) return 3;
    if (spec.startsWith("node-opcua")) return 2;
    return 1;
}

function applyTypeOnlyImports(file: SourceFile) {
    // Pass 1: collect identifier names used in value (runtime) positions.
    // Anything whose name appears only in TypeNode positions is type-only.
    const valueNames = new Set<string>();
    file.forEachDescendant((node) => {
        if (node.getKind() !== SyntaxKind.Identifier) return;
        const parent = node.getParent();
        if (!parent) return;
        // Declaration sites are not usages.
        if (Node.isImportSpecifier(parent)) return;
        if (Node.isImportClause(parent)) return;
        if (Node.isNamespaceImport(parent)) return;

        // Walk past QualifiedName chains: in dotted type references like
        // `UAProperty<UInt32, DataType.UInt32>` both `DataType` and the inner
        // `UInt32` have a QualifiedName as their immediate parent, but the
        // surrounding context is a TypeReference (a TypeNode).
        let ctx = parent;
        while (Node.isQualifiedName(ctx)) {
            const p = ctx.getParent();
            if (!p) break;
            ctx = p;
        }

        if (Node.isTypeNode(ctx)) return;

        // `interface X extends Foo` — Foo's parent is ExpressionWithTypeArguments
        // inside a HeritageClause inside an InterfaceDeclaration. Still type-only.
        if (Node.isExpressionWithTypeArguments(ctx)) {
            const heritage = ctx.getParent();
            if (heritage && Node.isHeritageClause(heritage)) {
                const decl = heritage.getParent();
                if (decl && Node.isInterfaceDeclaration(decl)) return;
            }
        }

        valueNames.add(node.getText());
    });

    // Pass 2: flip type-only on import specifiers, hoist when all qualify.
    file.getImportDeclarations().forEach((importDecl) => {
        if (importDecl.isTypeOnly()) return;
        const namedImports = importDecl.getNamedImports();
        if (namedImports.length === 0) return;

        const hasDefault = !!importDecl.getDefaultImport();
        const hasNamespace = !!importDecl.getNamespaceImport();

        const isTypeOnly = namedImports.map((spec) => {
            if (spec.isTypeOnly()) return true;
            const localName = spec.getAliasNode()?.getText() ?? spec.getNameNode().getText();
            return !valueNames.has(localName);
        });

        const allTypeOnly = isTypeOnly.every(Boolean);

        if (allTypeOnly && !hasDefault && !hasNamespace) {
            // Hoist to `import type { ... }`; clear redundant per-specifier `type` keywords.
            importDecl.setIsTypeOnly(true);
            namedImports.forEach((spec) => {
                if (spec.isTypeOnly()) spec.setIsTypeOnly(false);
            });
        } else {
            namedImports.forEach((spec, i) => {
                if (isTypeOnly[i] && !spec.isTypeOnly()) {
                    spec.setIsTypeOnly(true);
                }
            });
        }
    });
}

function regroupImports(file: SourceFile) {
    const imports = file.getImportDeclarations();
    if (imports.length === 0) return;

    const structures: OptionalKind<ImportDeclarationStructure>[] = imports.map((d) => d.getStructure());

    for (const d of [...imports].reverse()) d.remove();

    structures.sort((a, b) => {
        const ga = importGroup(a.moduleSpecifier);
        const gb = importGroup(b.moduleSpecifier);
        if (ga !== gb) return ga - gb;
        return a.moduleSpecifier.localeCompare(b.moduleSpecifier);
    });

    file.insertImportDeclarations(0, structures);

    const reinserted = file.getImportDeclarations();
    for (let i = 1; i < reinserted.length; i++) {
        const prevG = importGroup(reinserted[i - 1].getModuleSpecifierValue());
        const currG = importGroup(reinserted[i].getModuleSpecifierValue());
        if (prevG !== currG) {
            reinserted[i].prependWhitespace("\n");
        }
    }
}

const BIOME_IGNORE_EMPTY_INTERFACE = "// biome-ignore lint/suspicious/noEmptyInterface: forward-compatible placeholder for OPC-UA generated types";

function tidyEmptyInterfaces(file: SourceFile) {
    // Two complaints to resolve:
    //  1. Formatter wants `interface X {}` on a single line, not `{\n}`.
    //  2. suspicious/noEmptyInterface fires for `interface X {}` WITHOUT extends.
    //     For `interface X extends Y {}` the rule doesn't fire, so a directive
    //     there is reported as "unused".
    //
    // First pass (in reverse, since text only shrinks): collapse bodies.
    // Then a snapshot+descending pass for the biome-ignore directives, which
    // only target interfaces with no extends clause.
    const ifaces = file.getInterfaces();
    for (let i = ifaces.length - 1; i >= 0; i--) {
        const iface = ifaces[i];
        if (iface.getMembers().length !== 0) continue;
        const text = iface.getText();
        const collapsed = text.replace(/\{\s*\}\s*$/, "{}");
        if (collapsed !== text) {
            iface.replaceWithText(collapsed);
        }
    }

    // Re-fetch (previous replaceWithText calls may have invalidated nodes),
    // then snapshot positions before inserting comment lines.
    const positions: number[] = [];
    for (const iface of file.getInterfaces()) {
        if (iface.getMembers().length !== 0) continue;
        // Rule only fires when there's no extends clause.
        if (iface.getExtends().length !== 0) continue;
        const leading = iface.getLeadingCommentRanges().map((c) => c.getText()).join("\n");
        if (leading.includes("biome-ignore lint/suspicious/noEmptyInterface")) continue;
        positions.push(iface.getStart());
    }
    positions.sort((a, b) => b - a);
    for (const pos of positions) {
        file.insertText(pos, `${BIOME_IGNORE_EMPTY_INTERFACE}\n`);
    }
}

function fixFile(file: SourceFile) {
    // Sort alphabetically, dedupe, drop unused imports.
    file.organizeImports();

    // Mark type-only specifiers; hoist when the whole import qualifies.
    applyTypeOnlyImports(file);

    // Group: builtins → external → node-opcua-* → relative.
    regroupImports(file);

    // Collapse empty interface bodies to single-line `{}` and add a
    // suppression directive for the ones the lint rule actually fires on.
    tidyEmptyInterfaces(file);

    // Remove unused local variables (function-scope or top-level).
    // Use a single-pass identifier-name frequency map instead of ts-morph's
    // findReferences(), which calls TS's reference finder per declaration —
    // unreliable without dep resolution and 10–100× slower. For generated
    // code (no fancy scoping), name count > 1 is a sufficient proxy for "used".
    const identifierCounts = new Map<string, number>();
    file.forEachDescendant((node) => {
        if (node.getKind() === SyntaxKind.Identifier) {
            const txt = node.getText();
            identifierCounts.set(txt, (identifierCounts.get(txt) || 0) + 1);
        }
    });

    file.getVariableStatements().forEach((variableStatement) => {
        variableStatement.getDeclarations().forEach((declaration) => {
            const name = declaration.getName();
            const count = identifierCounts.get(name) ?? 0;
            // Count includes the declaration's own name node; >1 means referenced elsewhere.
            if (count <= 1) {
                console.log("removing unused variable=", name);
                declaration.remove();
            }
        });

        try {
            if (variableStatement.getDeclarations().length === 0) {
                console.log("removing variable statement:", variableStatement.getText());
                variableStatement.remove();
            }
        } catch (err) {
            console.log((err as Error).message);
        }
    });

    if (!dryRun) {
        file.saveSync();
    }
}

export async function cleanUpTypescriptModule(moduleFolder: string) {
    const sourceFolder = path.join(moduleFolder, "source");
    // Some namespaces in the catalog don't have a dedicated module folder
    // (their types are written into a shared package like node-opcua-nodeset-ua).
    // Nothing to tidy here — silently skip.
    if (!fs.existsSync(sourceFolder)) {
        return;
    }

    // Isolated project: only this module's own files, no tsconfig dependency
    // resolution. The cleanup analysis is purely syntactic (organizeImports +
    // type-position check via AST), so we don't need the full type checker —
    // and skipping dep resolution lets us run many namespaces in parallel
    // without ts-morph touching files outside this folder.
    const project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        skipLoadingLibFiles: true,
    });

    const dirFiles = await fs.promises.readdir(sourceFolder);

    for (const f of dirFiles) {
        const fullPath = path.join(sourceFolder, f);
        project.addSourceFileAtPath(fullPath);
    }

    for (const f of dirFiles) {
        const fullPath = path.join(sourceFolder, f);
        const sourceFile = project.getSourceFileOrThrow(fullPath);
        fixFile(sourceFile);
    }
}
