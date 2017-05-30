var opcMonitor = require('./monitor.js');

var templateBoiler1 =
   {
      "template": "Boiler1",
      "publishingInterval": 1000,
      "keepAliveCount": 20,
      "checkIsAliveInterval": 30000,
      "lastDataReceivedTimeout": 30000,
      "sendSnapshot": false, // when true, all item values will be sent
      "items": [
         { "ns": 4, "i": 1285, "id": "ns=4;i=1285", "map": "Boiler1_CCX001" },
         { "ns": 4, "i": 1259, "id": "ns=4;i=1259", "map": "Boiler1_DrumX001_LIX001" },
         { "ns": 4, "i": 1276, "id": "ns=4;i=1276", "map": "Boiler1_FCX001" },
         { "ns": 4, "i": 1280, "id": "ns=4;i=1280", "map": "Boiler1_LCX001" },
         { "ns": 4, "i": 1244, "id": "ns=4;i=1244", "map": "Boiler1_PipeX001_FTX001" },
         { "ns": 4, "i": 1267, "id": "ns=4;i=1267", "map": "Boiler1_PipeX002_FTX002" }
      ]
   };

opcMonitor.monitor(templateBoiler1, "opc.tcp://10.1.22.51:51210/UA/SampleServer");
var started = (new Date()).getTime();

setInterval(function () {
   // run for ever
   var now = (new Date()).getTime();
   console.log("Monitor now running for " + (now - started) / 1000 + " seconds");
}, (1000 * 60 )); 
