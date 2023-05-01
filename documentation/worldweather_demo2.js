const cities = [
    "London",
    "Paris",
    "New York",
    "Moscow",
    "Ho chi min",
    "Benjing",
    "Reykjavik",
    "Nouakchott",
    "Ushuaia",
    "Longyearbyen"
];

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

const city_data_map = {};

// a infinite round-robin iterator over the city array
const next_city = ((arr) => {
    let counter = arr.length;
    return function () {
        counter += 1;
        if (counter >= arr.length) {
            counter = 0;
        }
        return arr[counter];
    };
})(cities);

async function update_city_data(city) {
    try {
        const data = await getCityWeather(city);
        city_data_map[city] = extractUsefulData(data);
    } catch (err) {
        console.log("error city", city, err);
        return;
    }
}

// make a API call every 10 seconds
const interval = 10 * 1000;
setInterval(async () => {
    const city = next_city();
    console.log("updating city =", city);
    await update_city_data(city);
}, interval);
