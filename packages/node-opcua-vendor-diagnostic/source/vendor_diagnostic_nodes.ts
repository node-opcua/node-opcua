/* c8 ignore start */
import os from "node:os";

import { types } from "node:util";
import type { Namespace } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { ObjectIds } from "node-opcua-constants";
import { make_warningLog } from "node-opcua-debug";
import { type OPCUAServer, ServerEngine } from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";

const warningLog = make_warningLog(__filename);

const humanize = require("humanize");

interface UsageResult {
    memory: number;
    cpu: number;
}

/**

 * @param namespace
 * @param options
 * @param options.browseName
 * @private
 */
// This helper is unreachable in practice (install_optional_cpu_and_memory_usage_node has no callers
// anywhere in the workspace) and its body doesn't actually match AddVariableOptions — it assumes
// options.browseName is always a QualifiedNameOptions object (`.name.toString()`), but every call
// site in this file passes a plain string. Typing this precisely would mean fixing that pre-existing
// bug, which is out of scope for a lint pass on dead code.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
function addVariableWithHumanizeText(namespace: Namespace, options: any) {
    assert(options.componentOf || options.organizedBy);
    assert(typeof options.description === "string");

    const variable = namespace.addVariable(options);
    // add the xxxAsText property
    namespace.addVariable({
        propertyOf: variable,

        browseName: `${options.browseName.name.toString()}AsText`,
        dataType: "String",
        description: `${options.description} as text`,
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

 * @param server {OPCUAServer}
 *
 */
export function install_optional_cpu_and_memory_usage_node(server: OPCUAServer) {
    const engine = server.engine;
    assert(engine instanceof ServerEngine);

    let usage: {
        lookup(pid: number, options: { keepHistory: boolean }, callback: (err: Error | null, result: UsageResult) => void): void;
    } | null;
    try {
        const usage_module = "usage"; // we use a variable here to prevent error in webpack
        usage = require(usage_module); // a warning will be generated here with webpack as the module name is not a litteral
    } catch (err) {
        if (types.isNativeError(err)) {
            warningLog("err", err.message);
        }
        usage = null;
        // xx return;
    }

    const addressSpace = engine.addressSpace;
    if (!addressSpace) {
        throw new Error("engine.addressSpace must be initialized");
    }

    const namespace = addressSpace.getOwnNamespace();

    const vendorServerInfo = addressSpace.findNode(ObjectIds.Server_VendorServerInfo);
    if (!vendorServerInfo) {
        throw new Error("Server_VendorServerInfo node must exist in the address space");
    }

    let usage_result = { memory: 0, cpu: 100 };

    const pid = typeof process === "object" ? process.pid || 0 : 0;

    if (usage) {
        const options = { keepHistory: true };
        setInterval(() => {
            usage.lookup(pid, options, (err: Error | null, result: UsageResult) => {
                usage_result = result;
                warningLog("result Used Memory: ", humanize.filesize(result.memory), " CPU ", Math.round(result.cpu), " %");
                if (err) {
                    warningLog("err ", err);
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
        warningLog("skipping installation of cpu_usage and memory_usage nodes");
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
/* c8 ignore stop */
