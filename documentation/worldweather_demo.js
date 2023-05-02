const fs = require("fs");
const key = fs.readFileSync("openweathermap.key");

async function getCityWeather(city) {
    const url = `https://open-weather13.p.rapidapi.com/city/${city}`;
    const options = {
        method: "GET",
        headers: {
            "X-RapidAPI-Key": key,
            "X-RapidAPI-Host": "open-weather13.p.rapidapi.com"
        }
    };

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        console.log(result);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}

function unixEpoqToDate(unixDate) {
    const d = new Date(0);
    d.setUTCSeconds(unixDate);
    return d;
}

function extractUsefulData(data) {
    return {
        city: data.city,
        date: new Date(),
        observation_time: unixEpoqToDate(data.dt),
        temperature: data.main.temp,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        weather: data.weather[0].main
    };
}
const city = "London";

(async () => {
    try {
        const data = await getCityWeather(city);
        console.log("data = data", data);
        console.log(" city =", city);
        console.log(" time =", data.dt); // unix epoc ( nb of second since 1/1/1970
        console.log(" temperature =", data.main.temp);
        console.log(" pressure    =", data.main.pressure);
    } catch (err) {
        console.log("Error = ", err);
    }
})();
