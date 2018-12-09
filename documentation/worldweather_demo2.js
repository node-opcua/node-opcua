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
