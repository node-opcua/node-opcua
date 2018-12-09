/*global require,console */
/*jshint evil:true */
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
const city = "London";
getCityWeather(city,function(err,data) {
    if (!err) {
    console.log("data = data",data);
        console.log(" city =",city);
        console.log(" time =",data.observation_time);
        console.log(" temperature =",    data.temperature);
        console.log(" pressure    =",    data.pressure);
    }
});
