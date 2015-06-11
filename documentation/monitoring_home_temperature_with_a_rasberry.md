# Monitoring home temperature with OPC/UA server running on a RaspberryPi

In this example, we want to turn a RaspberryPi into a OPCUA server exposing temperature values.

## ingredients

   # a RaspberryPI REV B
   # An SD Card with Raspbian installed
   # a D18B20 1-Wire Temperature sensor
   # a 470kOhm resistor
   # a breadboard, and jumper wire

## doing the wiring

see here (http://www.raspberrypi-spy.co.uk/2013/03/raspberry-pi-1-wire-digital-thermometer-sensor/)


## preparing the project

```
$ cd homeserver
$ npm init
$ npm install q node-w1bus
```




```
var w1bus = require("node-w1bus");

var bus = w1bus.create();
var opcua = require("node-opcua");

var sensors = [];

function find_sensors(done) {
   bus.listAllSensors().then(function(data){
      sensors = data.ids;
      done();
   }).catch(function(err) { console.log("error",err); });
}


function read_sensor(sensor,callback) {

   bus.getValueFrom(sensor)
   .then(function(res){  callback(null,res.result); })
   .catch(callback);

};
var Q=require("q");

function read_all_sensors(done) {

   var i =0;
   sensors.forEach(function(sensor) {
     console.log(sensor);
     read_sensor(sensor,function(err,value) {
        i+=1;
        if ( i===sensors.length){
          done(err);
        }
     });
   });

}



find_sensors(function() {
   console.log(sensors);
   read_all_sensors(function(err,values){
     console.log(err);
     console.log(values);
     start_server();
   });
});



function start_server() {

var server = new opcua.OPCUAServer({

port: 1234
});

server.buildInfo.productName ="Rapsberry 1-Wire OPCUA Server"

function post_initialize() {

  server.engine.addFolder("Objects",{ browseName: "Devices"});

  sensors.forEach(function(sensor) { install_sensor(sensor); });

};

var value1 = -10.0;
function install_sensor(sensor) {

      var sensorName = "TemperatureSensor";
      server.engine.addFolder("Devices",{browseName: sensorName});

      setInterval(function() {
           read_sensor(sensor,function(err,result) {
                value1 = result.value;
                console.log("result=",result, " v=",value1);
           });
      },1000);
      server.engine.addVariable(sensorName,{
        nodeId: "ns=1;s=Temperature",
        browseName: "temperature",
        dataType: "Double",
        value: {
            get: function () {
                return new opcua.Variant({dataType: opcua.DataType.Double, value: value1 });
            }
        }
      });
};

server.initialize(post_initialize);

server.start(function() {
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log("port ", server.endpoints[0].port);
    var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    console.log(" the primary server endpoint url is ", endpointUrl );
});
}


