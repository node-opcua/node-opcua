/*global require,console,setInterval */
Error.stackTraceLimit = Infinity;

/*global require,setInterval,console */
const cities = [ 'London','Paris','New York','Moscow','Ho chi min','Benjing','Reykjavik' ,'Nouakchott','Ushuaia' ,'Longyearbyen'];
// read the World Weather Online API key.
const fs = require("fs");
const key = fs.readFileSync("worldweatheronline.key");
const request = require("request");
function getCityWeather(city,callback) {
    const api_url="http://api.worldweatheronline.com/free/v2/weather.ashx?q="+city+"+&format=json&key="+ key;
    const options = {
        url: api_url,
        "content-type": "application-json",
        json: ""
    };
    request(options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        const data  = perform_read(city,body);
        callback(null,data);
      } else {
        callback(error);
      }
    });
}
function perform_read(city,body) {
    const obj = JSON.parse(body);
    const current_condition = obj.data.current_condition[0];
    const request = obj.data.request[0];
    return  {
        city:               request.query,
        date:               new Date(),
        observation_time:   current_condition.observation_time,
        temperature:        parseFloat(current_condition.temp_C),
        humidity:           parseFloat(current_condition.humidity),
        pressure:           parseFloat(current_condition.pressure),
        weather:            current_condition.weatherDesc.value
    };
}
const city_data_map = { };
// a infinite round-robin iterator over the city array
function next_city (arr) {
   const counter = arr.length;
   return function() {
      counter += 1;
      if (counter>=arr.length) {
        counter = 0;
      }
      return arr[counter];
   };
}(cities);
function update_city_data(city) {
    getCityWeather(city,function(err,data) {
         if (!err) {
            city_data_map[city] = data;
            console.log(city,JSON.stringify(data, null," "));
         }  else {
            console.log("error city",city , err);
         }
     });
}
// make a API call every 10 seconds
const interval = 10* 1000;
setInterval(function() {
     const city = next_city();
     update_city_data(city);
}, interval);

const opcua = require("node-opcua");

const server = new opcua.OPCUAServer({
   port: 4334 // the port of the listening socket of the server
});

server.buildInfo.productName = "WeatherStation";
server.buildInfo.buildNumber = "7658";
server.buildInfo.buildDate = new Date(2014,5,2);
function post_initialize() {
    console.log("initialized");
    function construct_my_address_space(server) {
       // declare some folders
       const addressSpace = server.engine.addressSpace;
       const namespace = addressSpace.getOwnNamespace();
       const citiesNode  = namespace.addFolder("ObjectsFolder",{ browseName: "Cities"});
       function create_CityNode(city_name) {
           // declare the city node
           const cityNode = namespace.addFolder(citiesNode,{ browseName: city_name });
           namespace.addVariable({
               componentOf: cityNode,
               browseName: "Temperature",
               dataType: "Double",
               value: {  get: function () { return extract_value(city_name,"temperature"); } }
           });
           namespace.addVariable({
               componentOf: cityNode,
               browseName: "Humidity",
               dataType: "Double",
               value: {  get: function () { return extract_value(city_name,"humidity"); } }
           });
           namespace.addVariable({
               componentOf: cityNode,
               browseName: "Pressure",
               dataType: "Double",
               value: {  get: function () { return extract_value(city_name,"pressure"); } }
           });
       }
       cities.forEach(function(city) {
           create_CityNode(city);
       });
       function extract_value(city_name,property) {
           const city = city_data_map[city_name];
           if (!city) {
               return opcua.StatusCodes.BadDataUnavailable
           }
           const value = city[property];
           return new opcua.Variant({dataType: opcua.DataType.Double, value: value });
       }
    }
    construct_my_address_space(server);
    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );        
    });
}
server.initialize(post_initialize);
