Error.stackTraceLimit = Infinity;
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

const { OPCUAServer, DataType, StatusCodes, Variant } = require("node-opcua");

function construct_my_address_space(server) {
    // declare some folders
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const objectsFolder = addressSpace.rootFolder.objects;

    const citiesNode = namespace.addFolder(objectsFolder, { browseName: "Cities" });

    for (let city_name of cities) {
        // declare the city node
        const cityNode = namespace.addFolder(citiesNode, { browseName: city_name });
        namespace.addVariable({
            componentOf: cityNode,
            browseName: "Temperature",
            nodeId: `s=${city_name}-Temperature`,
            dataType: "Double",
            minimumSamplingInterval: 100,
            value: {
                get: function () {
                    return extract_value(DataType.Double, city_name, "temperature");
                }
            }
        });
        namespace.addVariable({
            componentOf: cityNode,
            nodeId: `s=${city_name}-Humidity`,
            browseName: "Humidity",
            dataType: "Double",
            minimumSamplingInterval: 100,
            value: {
                get: function () {
                    return extract_value(DataType.Double, city_name, "humidity");
                }
            }
        });
        namespace.addVariable({
            componentOf: cityNode,
            nodeId: `s=${city_name}-Pressure`,
            browseName: "Pressure",
            dataType: "Double",
            minimumSamplingInterval: 100,
            value: {
                get: function () {
                    return extract_value(DataType.Double, city_name, "pressure");
                }
            }
        });
        namespace.addVariable({
            componentOf: cityNode,
            nodeId: `s=${city_name}-Weather`,
            browseName: "Weather",
            dataType: "String",
            minimumSamplingInterval: 100,
            value: {
                get: function () {
                    return extract_value(DataType.String, city_name, "weather");
                }
            }
        });
    }
}
function extract_value(dataType, city_name, property) {
    const city = city_data_map[city_name];
    if (!city) {
        return StatusCodes.BadDataUnavailable;
    }

    const value = city[property];
    return new Variant({ dataType, value: value });
}

(async () => {
    try {
        const server = new OPCUAServer({
            port: 4334, // the port of the listening socket of the servery
            buildInfo: {
                productName: "WeatherStation",
                buildNumber: "7658",
                buildDate: new Date(2019, 6, 14)
            }
        });

        await server.initialize();

        construct_my_address_space(server);

        await server.start();

        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl);
    } catch (err) {
        console.log("Error = ", err);
    }
})();
