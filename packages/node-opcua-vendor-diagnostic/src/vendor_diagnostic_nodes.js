"use strict";


const assert = require("node-opcua-assert").assert;

const ServerEngine = require("node-opcua-server").ServerEngine;
const Variant = require("node-opcua-variant").Variant;
const DataType = require("node-opcua-variant").DataType;
const ObjectIds = require("node-opcua-constants").ObjectIds;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const humanize = require("humanize");

/**
 * @method addVariableWithHumanizeText
 * @param engine
 * @param options
 * @param options.browseName
 * @private
 */
function addVariableWithHumanizeText(namespace, options) {

    assert(options.componentOf || options.organizedBy);
    assert(typeof options.description === "string");

    const variable = namespace.addVariable(options);
    // add the xxxAsText property
    namespace.addVariable({

        propertyOf: variable,

        browseName: options.browseName.name.toString() + "AsText",
        description: options.description + " as text",
        dataType: "String",
        minimumSamplingInterval: options.minimumSamplingInterval,
        value: {
            get: function () {
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
function install_optional_cpu_and_memory_usage_node(server) {

    const engine = server.engine;
    assert(engine instanceof ServerEngine);

    let usage;
    try {
        usage = require("usage");
    } catch (err) {
        console.log("err", err.message);
        usage = null;
        //xx return;
    }

    const addressSpace = engine.addressSpace;

    const namespace = addressSpace.getPrivateNamespace();

    const folder = addressSpace.findNode(ObjectIds.Server_VendorServerInfo);

    let usage_result = {memory: 0, cpu: 100};

    const pid = process.pid;
    const os = require("os");

    if (usage) {

        const options = {keepHistory: true};
        setInterval(function () {
            usage.lookup(pid, options, function (err, result) {
                usage_result = result;
                console.log("result Used Memory: ", humanize.filesize(result.memory), " CPU ", Math.round(result.cpu), " %");
                if (err) { console.log("err ",err); }
            });
        }, 1000);

        namespace.addVariable({

            organizedBy: folder,

            browseName:    "CPUUsage",
            description:   "Current CPU usage of the server process",
            nodeId:        "s=CPUUsage",
            dataType:      "Double",
            minimumSamplingInterval: 1000,
            value: {
                get: function () {
                    if (!usage_result) {
                        return StatusCodes.BadResourceUnavailable;
                    }
                    return new Variant({dataType: DataType.Double, value: Math.round(usage_result.cpu, 2)});
                }
            }
        });


        addVariableWithHumanizeText(namespace,{
            organizedBy: folder,
            browseName:  "MemoryUsage",
            nodeId:      "s=MemoryUsage",
            description: "Current memory usage of the server process",
            dataType:    "Number",
            minimumSamplingInterval: 1000,
            value: {
                get: function () {
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
        description: "% of  memory used by the server",
        nodeId: "s=PercentageMemoryUsed",
        dataType: "Number",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                const percent_used = Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100);
                return new Variant({dataType: DataType.Double, value: percent_used});
            }
        }
    });

    addVariableWithHumanizeText(namespace, {
        organizedBy: folder,
        browseName: "SystemMemoryTotal",
        description: "Total Memory usage of the server",
        nodeId: "s=SystemMemoryTotal",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                const memory = os.totalmem();
                return new Variant({dataType: DataType.UInt64, value: memory});
            }
        }
    });

    addVariableWithHumanizeText(namespace,{
        organizedBy: folder,
        browseName: "SystemMemoryFree",
        description: "Free Memory usage of the server in MB",
        nodeId: "s=SystemMemoryFree",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                const memory = os.freemem();
                return new Variant({dataType: DataType.UInt64, value: memory});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,
        browseName: "NumberOfCPUs",
        description: "Number of cpus on the server",
        nodeId: "s=NumberOfCPUs",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                return new Variant({dataType: DataType.UInt32, value: os.cpus().length});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,
        browseName: "Arch",
        description: "ServerArchitecture",
        nodeId: "s=ServerArchitecture",
        dataType: "String",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                return new Variant({dataType: DataType.String, value: os.type()});
            }
        }
    });

    addVariableWithHumanizeText(namespace,{
        organizedBy: folder,
        browseName: "BytesWritten",
        description: "number of bytes written by the server",
        nodeId: "s=BytesWritten",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                return new Variant({dataType: DataType.UInt64, value: server.bytesWritten});
            }
        }
    });

    addVariableWithHumanizeText(namespace,  {
        organizedBy: folder,
        browseName: "BytesRead",
        description: "number of bytes read by the server",
        nodeId: "s=BytesRead",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                return new Variant({dataType: DataType.UInt64, value: server.bytesRead});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,
        browseName: "TransactionsCount",
        description: "total number of transactions performed the server",
        nodeId: "s=TransactionsCount",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                return new Variant({dataType: DataType.UInt32, value: server.transactionsCount});
            }
        }
    });

    namespace.addVariable({
        organizedBy: folder,
        browseName: "ConnectionsCount",
        description: "number of active Connections",
        nodeId: "s=ConnectionCount",
        dataType: "String",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: {
            get: function () {
                return new Variant({dataType: DataType.String, value: humanize.filesize(server.currentChannelCount)             });
            }
        }
    });

}

exports.install_optional_cpu_and_memory_usage_node = install_optional_cpu_and_memory_usage_node;
