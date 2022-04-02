import * as chalk from "chalk";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantLike } from "node-opcua-variant";

/**
 *
 * @param session
 * @param fields
 * @param eventFields
 */
export async function dumpEvent(session: IBasicSession, fields: string[], eventFields: Variant[]): Promise<void> {
    async function getBrowseName(_session: IBasicSession, nodeId: NodeId): Promise<string> {
        const dataValue = await _session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId
        });
        if (dataValue.statusCode === StatusCodes.Good) {
            const browseName = dataValue.value.value.name!;
            return browseName;
        } else {
            return "???";
        }
    }
    function w(str: string, l: number): string {
        return str.padEnd(l, " ").substring(0, l);
    }
    async function __dumpEvent1(_session: IBasicSession, _fields: any, variant: VariantLike, index: number) {
        if (variant.dataType === DataType.Null) {
            return;
        }
        if (variant.dataType === DataType.NodeId) {
            const name = await getBrowseName(_session, variant.value);
            // tslint:disable-next-line: no-console
            console.log(
                chalk.yellow(w(name, 30), w(_fields[index], 25)),
                chalk.cyan(w(DataType[variant.dataType], 10).toString()),
                chalk.cyan.bold(name),
                "(",
                w(variant.value, 20),
                ")"
            );
        } else {
            // tslint:disable-next-line: no-console
            console.log(
                chalk.yellow(w("", 30), w(_fields[index], 25)),
                chalk.cyan(w(DataType[variant.dataType as number], 10).toString()),
                variant.value
            );
        }
    }

    async function __dumpEvent(_session: IBasicSession, _fields: string[], _eventFields: Variant[]) {
        let index = 0;
        const promises = [];
        for (const variant of _eventFields) {
            promises.push(__dumpEvent1(_session, _fields, variant, index));
            index++;
        }
        await Promise.all(promises);
    }
    await __dumpEvent(session, fields, eventFields);
}
