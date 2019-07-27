
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
const city = "London";

(async () => {

    try  {
        const data = await getCityWeather(city);
        console.log("data = data",data);
        console.log(" city =",city);
        console.log(" time =",data.dt); // unix epoc ( nb of second since 1/1/1970
        console.log(" temperature =",    data.main.temp);
        console.log(" pressure    =",    data.main.pressure);
    }
    catch(err) {
        console.log("Error = ", err);
    }
})();
