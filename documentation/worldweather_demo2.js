/*global require,setInterval,console */
const cities = [
    'London', 'Paris','New York','Moscow','Ho chi min','Benjing','Reykjavik' ,'Nouakchott','Ushuaia' ,'Longyearbyen'];


const fs = require("fs");
const key = fs.readFileSync("openweathermap.key");

const unirest = require("unirest");
async function getCityWeather(city) {

    const result = await new Promise((resolve) => {
        unirest.get(
            "https://community-open-weather-map.p.rapidapi.com/weather?id=2172797"
            + "&units=metric"
            + "&mode=json"
            + `&q=${city}`)
        .header("X-RapidAPI-Host", "community-open-weather-map.p.rapidapi.com")
        .header("X-RapidAPI-Key", key)
        .end(
            (response) => resolve(response)
        );
    });
    if (result.status !== 200) {
        throw new Error("API error");
    }
    return result.body;
}


function unixEpoqToDate(unixDate) {
    const d = new Date(0);
    d.setUTCSeconds(unixDate);
    return d;
}

function extractUsefulData(data) {
    return  {
        city:               data.city,
        date:               new Date(),
        observation_time:   unixEpoqToDate(data.dt),
        temperature:        data.main.temp,
        humidity:           data.main.humidity,
        pressure:           data.main.pressure,
        weather:            data.weather[0].main
    };
}

const city_data_map = { };

// a infinite round-robin iterator over the city array
const next_city  = ((arr) => {
   let counter = arr.length;
   return function() {
      counter += 1;
      if (counter>=arr.length) {
        counter = 0;
      }
      return arr[counter];
   };
})(cities);

async function update_city_data(city) {

    try {
        const data  = await getCityWeather(city);
        city_data_map[city] = extractUsefulData(data);
    }
    catch(err) {
        console.log("error city",city , err);
        return ;
    }
}

// make a API call every 10 seconds
const interval = 10 * 1000;
setInterval(async () => {
     const city = next_city();
     console.log("updating city =",city);
     await update_city_data(city);
}, interval);
