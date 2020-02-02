import * as fs from "fs";
import {
    AddressSpace,
    generateAddressSpace,
    NodeIdManager,
    Namespace
} from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

export type Symbols = Array<[string, number, string]>;

export interface BuildModelOptions {
    version: string;
    namespaceUri: string;
    xmlFiles: string[];
    createModel: (addressSpace: AddressSpace) => void;
    presetSymbols?: Symbols;
}

export async function buildModel(data: BuildModelOptions): Promise<{ markdown: string, xmlModel: string, symbols: Symbols }> {
    try {
        const addressSpace = AddressSpace.create();

        // create own namespace (before loading other xml files)
        const ns = addressSpace.registerNamespace(data.namespaceUri);

        const nodeIdManager = ((ns as any)._nodeIdManager) as NodeIdManager;
        if (data.presetSymbols) {
            nodeIdManager.setSymbols(data.presetSymbols);
        }

        await generateAddressSpace(addressSpace, data.xmlFiles);

        data.createModel(addressSpace);

        const xmlModel = ns.toNodeset2XML();
        const symbols = nodeIdManager.getSymbols();
        const doc = await buildDocumentationToString(ns);
        addressSpace.dispose();

        return { xmlModel, symbols, markdown: doc };
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.log("Error", err);
        throw err;
    }
}

import * as parse from "csv-parse";
import { Parser } from "csv-parse";
import { displayNodeElement } from "./displayNodeElement";
import { buildDocumentationToString } from "./generate_markdown_doc";

function toCSV(arr: Symbols) {
    const line: string[] = [];
    for (const [name, value, nodeClass] of arr) {
        line.push([name, value, nodeClass].join(","));
    }
    return line.join("\n");
}

export async function saveSymbolsToCSV(csvFilename: string, symbols: Symbols): Promise<void> {
    await writeFile(csvFilename, toCSV(symbols), "utf-8");
}

export async function getPresetSymbolsFromCSV(csvFilename: string): Promise<Symbols> {
    try {
        const data = await readFile(csvFilename, "utf-8");

        const records = await new Promise((resolve) => {
            const output: any[] = [];
            parse(data, {
                cast: (value, context) => {
                    if (context.index === 1) {
                        return parseInt(value, 10);
                    }
                    return value;
                }
            }).on("readable", function (this: Parser) {
                let record = this.read();
                while (record) {
                    output.push(record);
                    record = this.read();
                }
            }).on("end", () => {
                resolve(output);
            });
        });
        return records as Symbols;
    } catch (err) {
        // tslint:disable-next-line: no-console
        console.log("getPresetSymbols err = ", err.message);
        return [];
    }
}
