import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { IBasicSessionBrowseAsyncSimple, IBasicSessionReadAsyncSimple } from "node-opcua-pseudo-session";
import { EnumDefinition, StructureDefinition, type StructureField } from "node-opcua-types";
import { LineFile } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import type { Type } from "./convert_to_typescript";
import { type Cache, makeName2 } from "./private/cache";
import { getCorrespondingJavascriptType } from "./private/get_corresponding_data_type";
import {
    getBrowseName,
    getDefinition,
    getDescription,
    getIsAbstract,
    getSubtypeNodeId,
    type Import,
    makeTypeNameNew
} from "./private-stuff";
import { f1, f2, quotifyIfNecessary, toComment, toJavascritPropertyName } from "./utils2";

function requireFieldName(field: { name?: string | null }): string {
    if (!field.name) {
        throw new Error("field is expected to have a name");
    }
    return field.name;
}

export async function _exportDataTypeToTypescript(
    session: IBasicSessionReadAsyncSimple & IBasicSessionBrowseAsyncSimple,
    nodeId: NodeId,
    cache: Cache,
    f?: LineFile
): Promise<{ type: Type; content: string; typeName: string }> {
    const referenceBasicType = (name: string): string => {
        const t = { name, namespace: -1, module: "BasicType" };
        cache.ensureImported(t);
        return t.name;
    };

    f = f || new LineFile();

    const importCollector = (i: Import) => {
        cache.ensureImported(i);
    };
    const nodeClass = NodeClass.DataType;
    const description = await getDescription(session, nodeId);
    const definition = await getDefinition(session, nodeId);
    const browseName = await getBrowseName(session, nodeId);
    const isAbstract = await getIsAbstract(session, nodeId);

    const interfaceImport: Import = makeTypeNameNew(nodeClass, definition, browseName);
    const interfaceName = interfaceImport.name;

    const superType = await getSubtypeNodeId(session, nodeId);
    const baseInterfaceImport: Import = makeTypeNameNew(nodeClass, definition, superType.browseName);

    cache.ensureImported(baseInterfaceImport);

    const baseInterfaceName = baseInterfaceImport.name;
    if (!browseName.name) {
        throw new Error(`Expecting a browseName.name for node ${nodeId.toString()}`);
    }
    //  f.write(superType.toString());
    f.write(`/**`);
    if (description.text) {
        f.write(toComment(" * ", description.text || ""));
        f.write(` *`);
    }
    f.write(` * |           |${f1(" ")}|`);
    f.write(` * |-----------|${f2("-")}|`);
    f.write(` * | namespace |${f1(cache.namespace[nodeId.namespace].namespaceUri)}|`);
    f.write(` * | nodeClass |${f1(NodeClass[nodeClass])}|`);
    f.write(` * | name      |${f1(browseName.name.toString())}|`);
    f.write(` * | isAbstract|${f1(isAbstract.toString())}|`);
    f.write(` */`);

    let type: "basic" | "structure" | "enum" | "ua" = "basic";
    if (definition instanceof EnumDefinition) {
        type = "enum";
        f.write(`export enum ${interfaceName}  {`);
        if (!definition.fields) {
            throw new Error(`EnumDefinition is expected to have fields for ${interfaceName}`);
        }
        for (const field of definition.fields) {
            if (field.description.text) {
                f.write(`  /**`);
                f.write(toComment("   * ", field.description.text || ""));
                f.write(`   */`);
            }
            f.write(`  ${quotifyIfNecessary(requireFieldName(field))} = ${field.value[1]},`);
        }
        f.write(`}`);
    } else if (definition instanceof StructureDefinition) {
        if (baseInterfaceName === "DTUnion") {
            type = "structure";
            if (!definition.fields) {
                throw new Error(`StructureDefinition (Union) is expected to have fields for ${interfaceName}`);
            }
            const unionFields = definition.fields;
            for (let i = 0; i < unionFields.length; i++) {
                f.write(`export interface ${interfaceName}_${i} extends ${baseInterfaceName} {`);
                for (let j = 0; j < unionFields.length; j++) {
                    const field = unionFields[j];
                    if (!field) {
                        throw new Error(`StructureDefinition is expected to have a field at index ${j} for ${interfaceName}`);
                    }
                    const fieldName = toJavascritPropertyName(requireFieldName(field), { ignoreConflictingName: false });
                    if (j === i) {
                        await outputStructureField(f, field);
                    } else {
                        f.write(`  ${quotifyIfNecessary(fieldName)}?: never`);
                    }
                }
                f.write(`}`);
            }
            f.write(`export type ${interfaceName} = `);
            for (let i = 0; i < unionFields.length; i++) {
                f.write(`  | ${interfaceName}_${i}`);
            }
            f.write(`  ;`);
        } else {
            type = "structure";
            if (!definition.fields?.length && interfaceName !== "DTStructure") {
                f.write(`export type ${interfaceName} = ${baseInterfaceName};`);
            } else {
                if (interfaceName === "DTStructure") {
                    f.write(`export interface ${interfaceName} {`);
                } else {
                    f.write(`export interface ${interfaceName} extends ${baseInterfaceName} {`);
                }
                if (!definition.fields) {
                    throw new Error(`StructureDefinition is expected to have fields for ${interfaceName}`);
                }
                for (const field of definition.fields) {
                    await outputStructureField(f, field);
                }
                f.write(`}`);
                //

                referenceBasicType("ExtensionObject");
                // ache.ensureImported({ module: "BasicType", name: "ExtensionObject", namespace: 0 });
                // interface TighteningResultOptions extends Partial<DTTighteningResult> {}
                // interface TighteningResult extends ExtensionObject, DTTighteningResult {}
                const full = makeName2(interfaceName);

                // filter issue with UDTOpticalVerifierScanResult that has a decode:Uint32 conflicting with the ExtensionObject decode method

                const toAvoid = ["decode", "encode"];
                const collidingNames = definition.fields
                    ?.map((a) => toJavascritPropertyName(requireFieldName(a), { ignoreConflictingName: false }))
                    .filter((d) => toAvoid.indexOf(d.toLowerCase()) !== -1);

                const adpatedIntefaceName =
                    collidingNames.length === 0
                        ? interfaceName
                        : `Omit<${interfaceName},${collidingNames.map((a) => `"${a}"`).join(",")}>`;

                f.write(`export interface ${full} extends ExtensionObject, ${adpatedIntefaceName} {};`);
            }
        }
    } else {
        type = "basic";
        f.write(`// NO DEFINITION`);
        f.write(`export type ${interfaceName} = ${baseInterfaceName};`);
        // throw new Error("Invalid " + definition?.constructor.name);
    }
    return { type, content: f.toString(), typeName: interfaceName };

    async function outputStructureField(f: LineFile, field: StructureField) {
        const fieldName = toJavascritPropertyName(requireFieldName(field), { ignoreConflictingName: false });
        // special case ! fieldName=
        if (field.description.text) {
            f.write(`  /** ${field.description.text}*/`);
        }
        const opt = field.isOptional ? "?" : "";
        const arrayMarker = field.valueRank >= 1 ? "[]" : "";
        const { dataType, jtype } = await getCorrespondingJavascriptType(session, field.dataType, cache, importCollector);
        f.write(
            `  ${quotifyIfNecessary(fieldName)}${opt}: ${jtype}${arrayMarker}; // ${
                DataType[dataType]
            } ${field.dataType.toString()}`
        );
    }
}
