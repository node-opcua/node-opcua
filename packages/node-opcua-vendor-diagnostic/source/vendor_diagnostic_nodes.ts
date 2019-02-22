// tslint:disable:no-console
import * as os from "os";

import { Namespace } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { ObjectIds} from "node-opcua-constants";
import { ServerEngine } from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
// tslint:disable:no-var-requires
const humanize = require("humanize");

/**
 * @method addVariableWithHumanizeText
 * @param namespace
 * @param options
 * @param options.browseName
 * @private
 */
function addVariableWithHumanizeText(namespace: Namespace, options: any) {

    assert(options.componentOf || options.organizedBy);
    assert(typeof options.description === "string");

    const variable = namespace.addVariable(options);
    // add the xxxAsText property
    namespace.addVariable({

        propertyOf: variable,

        browseName: options.browseName.name.toString() + "AsText",
        dataType: "String",
        description: options.description + " as text",
        minimumSamplingInterval: options.minimumSamplingInterval,
        value: {
            get() {
                const v = options.value.get();
                if (v instanceof Variant) {
                    return new Variant({dataType: DataType.String, value: humanize.filesize(v.value)});
                } else {
                    return v;
                }
            }
        }
    });
}

/**
 *
 * optionally install a CPU Usage and Memory Usage node
 * ( condition : running on linux and require("usage")
 * @method install_optional_cpu_and_memory_usage_node
 * @param server {OPCUAServer}
 *
 */
export function install_optional_cpu_and_memory_usage_node(server: any) {

    const engine = server.engine;
    assert(engine instanceof ServerEngine);

    let usage: any;
    try {
        usage = require("usage");
    } catch (err) {
        console.log("err", err.message);
        usage = null;
        // xx return;
    }

    const addressSpace = engine.addressSpace;

    const namespace = addressSpace.getOwnNamespace();

    const folder = addressSpace.findNode(ObjectIds.Server_VendorServerInfo);

    let usage_result = {memory: 0, cpu: 100};

    const pid = process.pid;

    if (usage) {

        const options = {keepHistory: true};
        setInterval(() => {
            usage.lookup(pid, options,  (err: Error| null, result: any) => {
                usage_result = result;
                console.log("result Used Memory: ", humanize.filesize(result.memory), " CPU ", Math.round(result.cpu), " %");
                if (err) { console.log("err ", err); }
            });
        }, 1000);

        namespace.addVariable({

            organizedBy: folder,

            browseName:    "CPUUsage",
            dataType:      "Double",
            description:   "Current CPU usage of the server process",

            minimumSamplingInterval: 1000,
            nodeId:        "s=CPUUsage",
            value: {
                get: () => {
                    if (!usage_result) {
                        return StatusCodes.BadResourceUnavailable;
                    }
                    return new Variant({dataType: DataType.Double, value: Math.round(usage_result.cpu)});
                }
            }
        });

        addVariableWithHumanizeText(namespace, {
            browseName:  "MemoryUsage",
            dataType:    "Number",
            description: "Current memory usage of the server process",
            minimumSamplingInterval: 1000,
            nodeId:      "s=MemoryUsage",
            organizedBy: folder,
            value: {
                get: () => {
                    if (!usage_result) {
                        return StatusCodes.BadResourceUnavailable;
                    }
                    return new Variant({dataType: DataType.UInt32, value: usage_result.memory});
                }
            }
        });

    } else {
        console.log("skipping installation of cpu_usage and memory_usage nodes");
    }

    namespace.addVariable({
        organizedBy: folder,

        browseName: "PercentageMemoryUsed",
        dataType: "Number",
        description: "% of  memory used by the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=PercentageMemoryUsed",
        value: {
            get() {
                const percent_used = Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100);
                return new Variant({dataType: DataType.Double, value: percent_used});
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "SystemMemoryTotal",
        dataType: "Number",
        description: "Total Memory usage of the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=SystemMemoryTotal",
        value: {
            get() {
                const memory = os.totalmem();
                return new Variant({dataType: DataType.UInt64, value: memory});
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "SystemMemoryFree",
        dataType: "Number",
        description: "Free Memory usage of the server in MB",
        minimumSamplingInterval: 1000,
        nodeId: "s=SystemMemoryFree",
        value: {
            get() {
                const memory = os.freemem();
                return new Variant({dataType: DataType.UInt64, value: memory});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "NumberOfCPUs",
        dataType: "Number",
        description: "Number of cpus on the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=NumberOfCPUs",
        value: {
            get() {
                return new Variant({dataType: DataType.UInt32, value: os.cpus().length});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "Arch",
        dataType: "String",
        description: "ServerArchitecture",
        minimumSamplingInterval: 1000,
        nodeId: "s=ServerArchitecture",
        value: {
            get() {
                return new Variant({dataType: DataType.String, value: os.type()});
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "BytesWritten",
        dataType: "Number",
        description: "number of bytes written by the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=BytesWritten",
        value: {
            get() {
                return new Variant({dataType: DataType.UInt64, value: server.bytesWritten});
            }
        }
    });

    addVariableWithHumanizeText(namespace,  {
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "BytesRead",
        dataType: "Number",
        description: "number of bytes read by the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=BytesRead",
        value: {
            get() {
                return new Variant({dataType: DataType.UInt64, value: server.bytesRead});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "TransactionsCount",
        dataType: "Number",
        description: "total number of transactions performed the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=TransactionsCount",
        value: {
            get() {
                return new Variant({dataType: DataType.UInt32, value: server.transactionsCount});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,

        accessLevel: "CurrentRead",
        browseName: "ConnectionsCount",
        dataType: "String",
        description: "number of active Connections",
        minimumSamplingInterval: 1000,
        nodeId: "s=ConnectionCount",
        value: {
            get() {
                return new Variant({dataType: DataType.String, value: humanize.filesize(server.currentChannelCount)             });
            }
        }
    });

}
