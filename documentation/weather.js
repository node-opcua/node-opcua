/*global require,console,setInterval */

/*global require,setInterval,console */
var cities = [ 'London','Paris','New York','Moscow','Ho chi min','Benjing','Reykjavik' ,'Nouakchott','Ushuaia' ,'Longyearbyen'];

// read the World Weather Online API key.
var fs = require("fs");
var key = fs.readFileSync("worldweatheronline.key");

function getCityWeather(city,callback) {

    var api_url="http://api.worldweatheronline.com/free/v1/weather.ashx?q="+city+"+&format=json&key="+ key;

    var options = {
        url: api_url,
        "content-type": "application-json",
        json: ""
    };

    var request = require("request");
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        var data  = perform_read(city,body);
        callback(null,data);
      } else {
        callback(error);
      }
    });
}

function perform_read(city,body) {
    var obj = JSON.parse(body);
    var current_condition = obj.data.current_condition[0];
    var request = obj.data.request[0];
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

var city_data_map = { };

// a infinite round-robin iterator over the city array
var next_city = function(arr) {
   var counter = arr.length;
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
var interval = 10* 1000;

setInterval(function() {
     var city = next_city();
     update_city_data(city);
}, interval);

var opcua = require("node-opcua");

var server = new opcua.OPCUAServer({
   port: 4334 // the port of the listening socket of the server
});

server.buildInfo.productName = "WeatherStation";
server.buildInfo.buildNumber = "7658";
server.buildInfo.buildDate = new Date(2014,5,2);

function post_initialize() {
    console.log("initialized");

    function construct_my_address_space(server) {
       // declare some folders
       server.engine.createFolder("RootFolder",{ browseName: "Cities"});
       
       function create_CityNode(city_name) {
       
           // declare the city node
           server.engine.createFolder("Cities",{ browseName: city_name });
       
           server.engine.addVariableInFolder(city_name,{
               browseName: "Temperature",
               value: {
                   get: function () {
                       var value = city_data_map[city_name].temperature;
                       return new opcua.Variant({dataType: opcua.DataType.Double, value: value });
                   }
               }
           });
           server.engine.addVariableInFolder(city_name,{
               browseName: "Humidity",
               value: {
                   get: function () {
                       var value = city_data_map[city_name].humidity;
                       return new opcua.Variant({dataType: opcua.DataType.Double, value: value });
                   }
               }
           });
           server.engine.addVariableInFolder(city_name,{
               browseName: "Pressure",
               value: {
                   get: function () {
                       var value = city_data_map[city_name].pressure;
                       return new opcua.Variant({dataType: opcua.DataType.Double, value: value });
                   }
               }
           });
       }
       
       Object.keys(cities).forEach(function(city) {
           create_CityNode(city);
       });
    }
    construct_my_address_space(server);

    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        var endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );
    });
}
server.initialize(post_initialize);