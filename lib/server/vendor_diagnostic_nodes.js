require("requirish")._(module);

var opcua = require("index");
var OPCUAServer = opcua.OPCUAServer;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var humanize = require("humanize");

/**
 * optionally install a CPU Usage and Memory Usage node
 * ( condition : running on linux and require("usage")
 */
function install_optional_cpu_and_memory_usage_node(engine) {

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
            value: { get: function () {
                if (!usage_result) {
                    return opcua.StatusCodes.BadResourceUnavailable;
                }
                return new Variant({dataType: DataType.Double, value: usage_result.cpu});
            } }
        });

        engine.addVariableInFolder(folder, {
            browseName: "MemoryUsage",
            nodeId: "ns=2;s=MemoryUsage",
            description: "Current CPU usage of the server process",
            dataType: "Number",
            value: { get: function () {
                if (!usage_result) {
                    return opcua.StatusCodes.BadResourceUnavailable;
                }
                return new Variant({dataType: DataType.UInt32, value: usage_result.memory});
            } }
        });

    } else {
        console.log("skipping installation of cpu_usage and memory_usage nodes");
    }

    engine.addVariableInFolder(folder, {
        browseName: "PercentageMemoryUsed",
        description: "% of  memory used by the server",
        nodeId: "ns=2;s=PercentageMemoryUsed",
        dataType: "Number",
        value: { get: function () {
            var percent_used = Math.round((os.totalmem() - os.freemem())/os.totalmem() *100,1);
            return new Variant({dataType: DataType.Double, value: percent_used});
        } }
    });
    engine.addVariableInFolder(folder, {
        browseName: "SystemMemoryTotal",
        description: "Total Memory usage of the server in MB",
        nodeId: "ns=2;s=SystemMemoryTotal",
        dataType: "Number",
        value: { get: function () {
            var memory = os.totalmem()/1024/1024;
            return new Variant({dataType: DataType.Double, value: memory});
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "SystemMemoryFree",
        description: "Free Memory usage of the server in MB",
        nodeId: "ns=2;s=SystemMemoryFree",
        dataType: "Number",
        value: { get: function () {
            var memory = os.freemem()/1024/1024;
            return new Variant({dataType: DataType.Double, value: memory});
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "NumberOfCPUs",
        description: "Number of cpus on the server",
        nodeId: "ns=2;s=NumberOfCPUs",
        dataType: "Number",
        value: { get: function () {
            return new Variant({dataType: DataType.UInt32, value: os.cpus().length});
        } }
    });

    engine.addVariableInFolder(folder, {
        browseName: "Arch",
        description: "ServerArchitecture",
        nodeId: "ns=2;s=ServerArchitecture",
        dataType: "String",
        value: { get: function () {
            return new Variant({dataType: DataType.String, value: os.type()});
        } }
    });

}

exports.install_optional_cpu_and_memory_usage_node =install_optional_cpu_and_memory_usage_node;