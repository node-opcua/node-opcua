/*global require,setInterval,console */
var cities = [ 'London','Paris','New York','Moscow','Ho chi min','Benjing','Reykjavik' ,'Nouakchott','Ushuaia' ,'Longyearbyen'];

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

function get_city_weather(city,callback) {

    // read the World Weather Online API key.
    var fs = require("fs");
    var key = fs.readFileSync("worldweatheronline.key");

    var api_url="http://api.worldweatheronline.com/free/v1/weather.ashx?num_of_results=1&fx=no&q="+city+"+&format=json&key="+ key;

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

var city_data_map = { };

var next_city = function(cities) {
   var counter = cities.length;
   return function() {
      counter += 1;
      if (counter>=cities.length) {
        counter = 0;
      }
      return cities[counter];
   };
}(cities);



function update_city_data(city) {

    get_city_weather(city,function(err,data) {
         if (!err) {
            city_data_map[city] = data;
            console.log(city,JSON.stringify(data, null," "));
         }  else {
            console.log("error city",city , err);
         }
     });
}

// calculate the timeout interval to get a update every 5 minute for each city
var interval =( 6*100*60 )/ cities.length;

setInterval(function() {
     var city = next_city();
     update_city_data(city);
}, interval);