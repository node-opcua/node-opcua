import chalk from "chalk";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSessionReadAsyncSimple } from "node-opcua-pseudo-session";
import { DataType, Variant, VariantLike } from "node-opcua-variant";
import { make_traceLog } from "node-opcua-debug";

const traceLog = make_traceLog("ClientAlarmTool");

/**
 *
 * @param session
 * @param fields
 * @param eventFields
 */
export async function dumpEvent(session: IBasicSessionReadAsyncSimple, fields: string[], eventFields: Variant[]): Promise<void> {
    async function getBrowseName(_session: IBasicSessionReadAsyncSimple, nodeId: NodeId): Promise<string> {
        const dataValue = await _session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId
        });
        if (dataValue.statusCode.isGood()) {
            const browseName = dataValue.value.value.name!;
            return browseName;
        } else {
            return "???";
        }
    }
    function w(str: string, l: number): string {
        return (str || "").toString().padEnd(l, " ").substring(0, l);
    }
    async function __dumpEvent1(_session: IBasicSessionReadAsyncSimple, _fields: any, variant: VariantLike, index: number) {
        if (variant.dataType === DataType.Null) {
            return;
        }
        if (variant.dataType === DataType.NodeId) {
            const name = await getBrowseName(_session, variant.value);
            traceLog(
                chalk.yellow(w(name, 30), w(_fields[index], 25)),
                chalk.cyan(w(DataType[variant.dataType], 10).toString()),
                chalk.cyan.bold(name),
                "(",
                w(variant.value, 20),
                ")"
            );
        } else {
            // tslint:disable-next-line: no-console
            traceLog(
                chalk.yellow(w("", 30), w(_fields[index], 25)),
                chalk.cyan(w(DataType[variant.dataType as number], 10).toString()),
                variant.value
            );
        }
    }

    async function __dumpEvent(_session: IBasicSessionReadAsyncSimple, _fields: string[], _eventFields: Variant[]) {
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
