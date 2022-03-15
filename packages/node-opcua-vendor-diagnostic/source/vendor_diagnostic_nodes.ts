/* istanbul ignore file */
// tslint:disable:no-console
import * as os from "os";

import { Namespace } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { ObjectIds } from "node-opcua-constants";
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
                return new Variant({ dataType: DataType.String, value: humanize.filesize(v.value) });
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
        const usage_module = "usage"; // we use a variable here to prevent error in webpack
        usage = require(usage_module); // a warning will be generated here with webpack as the module name is not a litteral
    } catch (err) {
        if (err instanceof Error) {
            console.log("err", err.message);
        }
        usage = null;
        // xx return;
    }

    const addressSpace = engine.addressSpace;

    const namespace = addressSpace.getOwnNamespace();

    const vendorServerInfo = addressSpace.findNode(ObjectIds.Server_VendorServerInfo);

    let usage_result = { memory: 0, cpu: 100 };

    const pid = typeof process === "object" ? process.pid || 0 : 0;

    if (usage) {
        const options = { keepHistory: true };
        setInterval(() => {
            usage.lookup(pid, options, (err: Error | null, result: any) => {
                usage_result = result;
                console.log("result Used Memory: ", humanize.filesize(result.memory), " CPU ", Math.round(result.cpu), " %");
                if (err) {
                    console.log("err ", err);
                }
            });
        }, 1000);

        namespace.addVariable({
            componentOf: vendorServerInfo,

            browseName: "CPUUsage",
            dataType: DataType.Double,
            description: "Current CPU usage of the server process",

            minimumSamplingInterval: 1000,
            nodeId: "s=CPUUsage",
            value: {
                get: () => {
                    if (!usage_result) {
                        return StatusCodes.BadResourceUnavailable;
                    }
                    return new Variant({ dataType: DataType.Double, value: Math.round(usage_result.cpu) });
                }
            }
        });

        addVariableWithHumanizeText(namespace, {
            componentOf: vendorServerInfo,

            browseName: "MemoryUsage",
            dataType: DataType.UInt32,
            description: "Current memory usage of the server process",
            minimumSamplingInterval: 1000,
            nodeId: "s=MemoryUsage",
            value: {
                get: () => {
                    if (!usage_result) {
                        return StatusCodes.BadResourceUnavailable;
                    }
                    return new Variant({ dataType: DataType.UInt32, value: usage_result.memory });
                }
            }
        });
    } else {
        console.log("skipping installation of cpu_usage and memory_usage nodes");
    }

    namespace.addVariable({
        componentOf: vendorServerInfo,

        browseName: "PercentageMemoryUsed",
        dataType: DataType.Double,
        description: "% of  memory used by the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=PercentageMemoryUsed",
        value: {
            get() {
                const percent_used = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
                return new Variant({ dataType: DataType.Double, value: percent_used });
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "SystemMemoryTotal",
        dataType: DataType.UInt64,
        description: "Total Memory usage of the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=SystemMemoryTotal",
        value: {
            get() {
                const memory = os.totalmem();
                return new Variant({ dataType: DataType.UInt64, value: memory });
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "SystemMemoryFree",
        dataType: "UInt64",
        description: "Free Memory usage of the server in MB",
        minimumSamplingInterval: 1000,
        nodeId: "s=SystemMemoryFree",
        value: {
            get() {
                const memory = os.freemem();
                return new Variant({ dataType: DataType.UInt64, value: memory });
            }
        }
    });

    namespace.addVariable({
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "NumberOfCPUs",
        dataType: "UInt32",
        description: "Number of cpus on the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=NumberOfCPUs",
        value: {
            get() {
                return new Variant({ dataType: DataType.UInt32, value: os.cpus().length });
            }
        }
    });

    namespace.addVariable({
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "Arch",
        dataType: "String",
        description: "ServerArchitecture",
        minimumSamplingInterval: 1000,
        nodeId: "s=ServerArchitecture",
        value: {
            get() {
                return new Variant({ dataType: DataType.String, value: os.type() });
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "BytesWritten",
        dataType: "UInt64",
        description: "number of bytes written by the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=BytesWritten",
        value: {
            get() {
                return new Variant({ dataType: DataType.UInt64, value: server.bytesWritten });
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "BytesRead",
        dataType: "UInt64",
        description: "number of bytes read by the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=BytesRead",
        value: {
            get() {
                return new Variant({ dataType: DataType.UInt64, value: server.bytesRead });
            }
        }
    });

    namespace.addVariable({
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "TransactionsCount",
        dataType: "UInt32",
        description: "total number of transactions performed the server",
        minimumSamplingInterval: 1000,
        nodeId: "s=TransactionsCount",
        value: {
            get() {
                return new Variant({ dataType: DataType.UInt32, value: server.transactionsCount });
            }
        }
    });

    namespace.addVariable({
        componentOf: vendorServerInfo,

        accessLevel: "CurrentRead",
        browseName: "ConnectionsCount",
        dataType: "String",
        description: "number of active Connections",
        minimumSamplingInterval: 1000,
        nodeId: "s=ConnectionCount",
        value: {
            get() {
                return new Variant({ dataType: DataType.String, value: humanize.filesize(server.currentChannelCount) });
            }
        }
    });
}
