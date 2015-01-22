require("requirish")._(module);

var opcua = require("index");
var OPCUAServer = opcua.OPCUAServer;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var humanize = require("humanize");


/**
 *
 * @param parent
 * @param options
 * @param options.browseName
 */
function addVariableWithHumanizeText(engine,parent,options) {

    var variable = engine.addVariableInFolder(parent,options);

    // add the xxxAsText property
    engine.addVariableInFolder(variable, {
        browseName: options.browseName + "AsText",
        description: options.description + " as text",
        dataType: "String",
        minimumSamplingInterval: options.minimumSamplingInterval,
        value: { get: function () {
            var v = options.value.get();
            if (v instanceof Variant) {
                return new Variant({dataType: DataType.String, value:  humanize.filesize(v.value)});
            } else {
                return v;
            }
          }
        }
    });
}


var readOnly = "CurrentRead";
/**
 * optionally install a CPU Usage and Memory Usage node
 * ( condition : running on linux and require("usage")
 */
function install_optional_cpu_and_memory_usage_node(server) {

    var engine = server.engine;
    assert(engine instanceof opcua.ServerEngine);

    var usage;
    try {
        usage = require('usage');
    } catch(err) {

        //xx return;
    }

    var folder = engine.findObject(opcua.ObjectIds.Server_VendorServerInfo);

    var usage_result = { memory : 0 , cpu: 100};

    var pid = process.pid;
    var os = require('os');

    if (usage) {

        var options = { keepHistory: true };
        setInterval(function() {
            usage.lookup(pid, options, function(err, result) {
                usage_result  = result;
                console.log("result Used Memory: ", humanize.filesize(result.memory), " CPU ",Math.round(result.cpu) ," %"  );
            });
        },1000);

        engine.addVariableInFolder(folder, {
            browseName: "CPUUsage",
            description: "Current CPU usage of the server process",
            nodeId: "ns=2;s=CPUUsage",
            dataType: "Double",
            minimumSamplingInterval: 1000,
            value: { get: function () {
                if (!usage_result) {
                    return opcua.StatusCodes.BadResourceUnavailable;
                }
                return new Variant({dataType: DataType.Double, value: Math.round(usage_result.cpu,2)});
            } }
        });


        addVariableWithHumanizeText(engine,folder,        {
                browseName: "MemoryUsage",
                nodeId: "ns=2;s=MemoryUsage",
                description: "Current memory usage of the server process",
                dataType: "Number",
                minimumSamplingInterval: 1000,
                value: { get: function () {
                    if (!usage_result) {
                        return opcua.StatusCodes.BadResourceUnavailable;
                    }
                    return new Variant({dataType: DataType.UInt32, value:  usage_result.memory});
                } }
            }
        );

    } else {
        console.log("skipping installation of cpu_usage and memory_usage nodes");
    }

    engine.addVariableInFolder(folder, {
        browseName: "PercentageMemoryUsed",
        description: "% of  memory used by the server",
        nodeId: "ns=2;s=PercentageMemoryUsed",
        dataType: "Number",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            var percent_used = Math.round((os.totalmem() - os.freemem())/os.totalmem() *100,2);
            return new Variant({dataType: DataType.Double, value: percent_used});
        } }
    });

    addVariableWithHumanizeText(engine,folder, {
        browseName: "SystemMemoryTotal",
        description: "Total Memory usage of the server",
        nodeId: "ns=2;s=SystemMemoryTotal",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            var memory = os.totalmem();
            return new Variant({dataType: DataType.UInt64, value: memory });
        } }
    });

    addVariableWithHumanizeText(engine,folder, {
        browseName: "SystemMemoryFree",
        description: "Free Memory usage of the server in MB",
        nodeId: "ns=2;s=SystemMemoryFree",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            var memory = os.freemem();
            return new Variant({dataType: DataType.UInt64, value: memory });
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "NumberOfCPUs",
        description: "Number of cpus on the server",
        nodeId: "ns=2;s=NumberOfCPUs",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            return new Variant({dataType: DataType.UInt32, value: os.cpus().length});
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "Arch",
        description: "ServerArchitecture",
        nodeId: "ns=2;s=ServerArchitecture",
        dataType: "String",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            return new Variant({dataType: DataType.String, value: os.type()});
        } }
    });

    addVariableWithHumanizeText(engine,folder, {
        browseName: "BytesWritten",
        description: "number of bytes written by the server",
        nodeId: "ns=2;s=BytesWritten",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            return new Variant({dataType: DataType.UInt64, value: server.bytesWritten});
        } }
    });

    addVariableWithHumanizeText(engine,folder, {
        browseName: "BytesRead",
        description: "number of bytes read by the server",
        nodeId: "ns=2;s=BytesRead",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            return new Variant({dataType: DataType.UInt64, value: server.bytesRead});
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "TransactionsCount",
        description: "total number of transactions performed the server",
        nodeId: "ns=2;s=TransactionsCount",
        dataType: "Number",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            return new Variant({dataType: DataType.UInt32, value: server.transactionsCount });
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "ConnectionsCount",
        description: "number of active Connections",
        nodeId: "ns=2;s=ConnectionCount",
        dataType: "String",
        accessLevel: "CurrentRead",
        minimumSamplingInterval: 1000,
        value: { get: function () {
            return new Variant({dataType: DataType.String, value: humanize.filesize(server.currentChannelCount)});
        } }
    });




}

exports.install_optional_cpu_and_memory_usage_node =install_optional_cpu_and_memory_usage_node;