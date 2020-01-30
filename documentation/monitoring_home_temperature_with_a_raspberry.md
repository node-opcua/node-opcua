# Monitoring home temperature with OPC/UA server running on a RaspberryPi

In this example, we want to turn a RaspberryPi into a OPCUA server exposing temperature values.

## ingredients

   - a RaspberryPI REV B
   - An SD Card with Raspbian installed
   - a D18B20 1-Wire Temperature sensor
   - a 470kOhm resistor
   - a breadboard, and jumper wire

## doing the wiring

see here (http://www.raspberrypi-spy.co.uk/2013/03/raspberry-pi-1-wire-digital-thermometer-sensor/)


## preparing the project

```
$ cd homeserver
$ npm init
$ npm install q node-w1bus
```




```javascript
const w1bus = require("node-w1bus");

const bus = w1bus.create();
const opcua = require("node-opcua");

let sensors = [];

function find_sensors(done) {
  bus
    .listAllSensors()
    .then(data => {
      sensors = data.ids;
      done();
    })
    .catch(function(err) {
      console.log("error", err);
    });
}

function read_sensor(sensor, callback) {
  bus
    .getValueFrom(sensor)
    .then(function(res) {
      callback(null, res.result);
    })
    .catch(callback);
}
const Q = require("q");

function read_all_sensors(done) {
  let i = 0;
  sensors.forEach(sensor => {
    console.log(sensor);
    read_sensor(sensor, (err, value) => {
      i += 1;
      if (i === sensors.length) {
        done(err);
      }
    });
  });
}

find_sensors(function() {
  console.log(sensors);
  read_all_sensors(function(err, values) {
    console.log(err);
    console.log(values);
    start_server();
  });
});

function start_server() {
  const server = new opcua.OPCUAServer({
    port: 1234
  });

  server.buildInfo.productName = "Rapsberry 1-Wire OPCUA Server";

  function post_initialize() {
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const devices = namespace.addFolder("ObjectsFolder", {
      browseName: "Devices"
    });

    sensors.forEach((sensor) => install_sensor(sensor));
  }

  let value1 = -10.0;
  function install_sensor(sensor) {
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const sensorName = "TemperatureSensor";

    const devices = addressSpace.rootFolder.objects.devices;

    const sensor = namespace.addObject({
      organizedBy: devices,
      browseName: sensorName
    });

    setInterval(() => {
      read_sensor(sensor, (err, result) => {
        value1 = result.value;
        console.log("result=", result, " v=", value1);
      });
    }, 1000);

    namespace.addVariable({
      propertyOf: sensor,
      nodeId: "ns=1;s=Temperature",
      browseName: "temperature",
      dataType: "Double",
      value: {
        get: () => {
          return new opcua.Variant({
            dataType: opcua.DataType.Double,
            value: value1
          });
        }
      }
    });
  }

  server.initialize(post_initialize);

  server.start(() => {
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log("port ", server.endpoints[0].port);
    const endpointUrl = server.endpoints[0].endpointDescriptions()[0]
      .endpointUrl;
    console.log(" the primary server endpoint url is ", endpointUrl);
  });
}
```

