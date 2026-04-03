/**
 * Static scalar, array, and multi-dimensional array variables + image loading.
 */
import fs from "node:fs";
import path from "node:path";
import type { Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { make_errorLog } from "node-opcua-debug";
import { DataType, Variant } from "node-opcua-variant";

import { addArrayVariable, addMultiDimensionalArrayVariable, addScalarVariable } from "./helpers";
import { typeAndDefaultValue } from "./type_defaults";

const errorLog = make_errorLog(__filename);

export async function addStaticVariables(namespace: Namespace, scalarFolder: UAObject): Promise<void> {
    const staticScalarFolder = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Scalars",
        description: "This folder will contain one item per supported data-type.",
        nodeId: "s=Static_Scalar"
    });

    // Scalar variables
    for (const e of typeAndDefaultValue) {
        const dataType = e.type;
        const realType = e.realType || dataType;
        const defaultValue = typeof e.defaultValue === "function" ? e.defaultValue() : e.defaultValue;
        addScalarVariable(namespace, staticScalarFolder, dataType, realType, defaultValue, "");
    }

    // Load images
    async function setImage(imageType: string, filename: string): Promise<void> {
        const fullPath = path.join(__dirname, "../../data", filename);
        const imageNode = namespace.findNode(`s=Static_Scalar_Image${imageType}`) as UAVariable;
        try {
            const data = await fs.promises.readFile(fullPath);
            imageNode.setValueFromSource(new Variant({ dataType: DataType.ByteString, value: data }));
        } catch (_err) {
            errorLog("cannot load file =", fullPath);
        }
    }

    await setImage("BMP", "image.bmp");
    await setImage("PNG", "tux.png");
    await setImage("GIF", "gif-anime.gif");
    await setImage("JPG", "tiger.jpg");

    // Array variables
    const staticArraysFolders = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Arrays",
        description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
        nodeId: "s=Static_Array"
    });
    for (const e of typeAndDefaultValue) {
        const realType = e.realType || e.type;
        addArrayVariable(namespace, staticArraysFolders, e.type, e.defaultValue, realType, 10, "");
    }

    // Multi-dimensional array variables
    const staticMultiDimensionalArrays = namespace.addObject({
        organizedBy: scalarFolder,
        browseName: "Multi-Dimensional Arrays",
        description: "Single dimension, suggested size of 10-elements per array. Unsupported types will be missing from the address-space.",
        nodeId: "s=Static_MultiDimensional_Array"
    });
    for (const e of typeAndDefaultValue) {
        const realType = e.realType || e.type;
        addMultiDimensionalArrayVariable(namespace, staticMultiDimensionalArrays, e.type, e.defaultValue, realType, 2, 3, "");
    }
}
