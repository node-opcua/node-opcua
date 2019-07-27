# Creating a OPC/UA server for a virtual weather station.


## Purpose

In my quest of exploring the ["Internet of Things"](http://en.wikipedia.org/wiki/Internet_of_Things) world,
I decided to create a simple weather station with 3 sensors mounted on my Raspberry computer.
I needed to buy some equipment to build the prototype. After studying different type of sensors (1-Wire,Analog,I2C),
I finally opted for I2C sensors. (I used I2C chips a long time ago, in a Junior Enterprise Project). 
I ordered a [breadboard](https://www.cl.cam.ac.uk/projects/raspberrypi/tutorials/robot/breadboard)
and [I2C temperature and humidity sensor](http://www.ebay.com/itm/BMP085-IIC-I2C-Barometric-Pressure-module-for-AVR-Arduino-/121233041012?ssPageName=ADME:L:OU:FR:3160).

While waiting for the equipment to be delivered, I though it was time to start coding the Server Application.

I got the idea of using a free Web-Service to get some realtime temperature and pressure information that I need to simulate the data.

The server is written in TypeScript, using [NodeJS](http://www.nodejs.org).

## retrieving Weather data using a REST API.

The virtual weather station need to extract the weather data from a web service.
[OpenWeatherMAP](https://rapidapi.com/community/api/open-weather-map) provides a free API.


### getting a key at open-weather-map

You will need to register to  [RapidAPI.com](https://rapidapi.com) to obtain
 your API key. Store you API key in a file name ```open-weather-map.key```, in your project folder.


### testing the API

The API is documented [here](https://rapidapi.com/community/api/open-weather-map).

For example, typing the following URL in the address bar of your web browser.

```
curl --get --include 'https://community-open-weather-map.p.rapidapi.com/weather?callback=test&id=2172797&units=%22metric%22+or+%22imperial%22&mode=xml%2C+html&q=London%2Cuk' \
  -H 'X-RapidAPI-Host: community-open-weather-map.p.rapidapi.com' \
  -H 'X-RapidAPI-Key: <put your key here>'
  ```
will return the following JSON data

```json
{
    "coord":{
        "lon":-0.13
        "lat":51.51
    }
    "sys":{
        "message":0.0223
        "country":"GB"
        "sunrise":1398055845
        "sunset":1398107249
    }
    "weather":[
        {
            "id":501
            "main":"Rain"
            "description":"moderate rain"
            "icon":"10d"
        }
    ]
    "base":"cmc stations"
    "main":{
        "temp":290.04
        "humidity":70
        "pressure":1003
        "temp_min":287.04
        "temp_max":293.15
    }
    "wind":{
        "speed":0.51
        "gust":3.6
        "deg":93
    }
    "rain":{
        "1h":1.02
    }
    "clouds":{
        "all":56
    }
    "dt":1398100214
    "id":2643743
    "name":"London"
    "cod":200
}
```


## Reading weather data

It is now time to code a function to extract the temperate, the pressure, and the humidity using nodeJs.

### preparing the project

First of all, let create the '''package.json''' file for our project.

``` sh
mkdir myweatherstation
cd myweatherstation
npm init
```

While we are here, let's install some of the npm modules that we need.

``` sh
npm install unirest --save
npm install node-opcua --save
```

### accessing the openweathermap API key

Our application will need to access our API developer key. Let's put it in a file named ```openweathermap.key``` in
our project folder. The key value can be easily read in nodejs using this code.

```javascript
const fs = require("fs");
const key = fs.readFileSync("openweathermap.key");
```


Lets write a small [worldweather_demo.js](#testing-the-rest-api "save:"), to experiment the api.

## testing the rest api

Our purpose is to create a ```getCityWeather``` asynchronous function that pass to a callback function
an object containing the temperature and pressure of a city. This function will be used this way:

<!-- compile with literate-programming create_a_weather_station.md !-->

```javascript
_"get city weather"
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
```

## get city weather

Let's write the method that reads the weather of a city.

```javascript

_"accessing the openweathermap API key"

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

_"extract useful data"
```

### extract useful data

The ```extractUsefulData``` function convert the raw data retrieved from the API,into a simpler Javascript object for our application.

```javascript

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
```

### reading data periodically

The Weather Station Server will have to query the weather data of a city on a regular basis. However, we have to be careful not to send too many queries to the web-server, as any exceeding requests will get rejected and will lead to a error:

``` html
<h1>Developer Over Rate</h1>
```

In NodeJs, the setInterval function can be used to perform a action periodically.

``` javascript
let london_data = {};
setInterval(function() {
   london_data = extractUsefulData(await getCityWeather("London"));
}, 60*1000);
```


Lets edit [worldweather_demo2.js](#making-a-round-robin-read "save:") to experiment this.

## making a round robin read

Why not make our server expose the weather variables of more than one city ?
Supposing we hold an array containing the city we want to monitor, our periodic call to the REST API will have to query the data for each city in turn.  We will store the most up to date weather data inside a map ```city_data_map``` .


I chose 10 cities spread in different continents and hemisphere.

Just to make it fun, I added Longyearbyen, the [northenmost city in the world](http://en.wikipedia.org/wiki/Northernmost_cities_and_towns) and
'Ushuaia' one of the [southernmost city](http://en.wikipedia.org/wiki/Southernmost_cities_and_towns).


```javascript
/*global require,setInterval,console */
const cities = [
    'London', 'Paris','New York','Moscow','Ho chi min','Benjing','Reykjavik' ,'Nouakchott','Ushuaia' ,'Longyearbyen'];

_"get city weather"

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
```


### Weather Server Skeleton

It is now time to create the skeleton of our weather server.


[weather.js](#Weather-Server-Skeleton "save:")

```javascript
/*global require,console,setInterval */
Error.stackTraceLimit = Infinity;

_"making a round robin read"

const opcua = require("node-opcua");


_"construct the address space"

(async () => {

    try {
      _"server instantiation"
    }
    catch(err) {
       console.log("Error = ",err);
    }
})();
```

#### server instantiation

```javascript

const server = new opcua.OPCUAServer({
   port: 4334, // the port of the listening socket of the servery
   buildInfo: {
     productName: "WeatherStation",
     buildNumber: "7658",
     buildDate: new Date(2019,6,14),
   }
});


await server.initialize();

construct_my_address_space(server);

await server.start();

console.log("Server is now listening ... ( press CTRL+C to stop)");
console.log("port ", server.endpoints[0].port);
const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
console.log(" the primary server endpoint url is ", endpointUrl );

```


#### construct the address space

The server address space will be made of a ```Cities``` folder containing one folder for each city.


```javascript
function construct_my_address_space(server) {
    // declare some folders
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const objectsFolder = addressSpace.rootFolder.objects;

    const citiesNode  = namespace.addFolder(objectsFolder,{ browseName: "Cities"});

    for (let city_name of cities) {
        // declare the city node
        const cityNode = namespace.addFolder(citiesNode,{ browseName: city_name });
        _"construct city weather variables"
    }
}
_"extracting a DataValue"
```

#### extracting a DataValue

Let's write a helper function (```extract_value```) to extract a city weather variable as DataValue.
Since the city weather data are read asynchronously at a very low rate, it is possible that the data doesn't exist
yet when the client will send its request. We have to be careful to handle this case appropriately.
In the absence of city data, I have chose to send a StatusCodes.UncertainInitalValue status code.

```javascript
function extract_value(dataType,city_name,property) {
    const city = city_data_map[city_name];
    if (!city) {
        return opcua.StatusCodes.BadDataUnavailable
    }

    const value = city[property];
    return new opcua.Variant({dataType, value: value });
}
```

#### construct city weather variables

Each city node exposes 3 read-only variables that can be instantiated this way:

```javascript
namespace.addVariable({
    componentOf: cityNode,
    browseName: "Temperature",
    nodeId: `s=${city_name}-Temperature`,
    dataType: "Double",
    value: {  get: function () { return extract_value(opcua.DataType.Double, city_name,"temperature"); } }
});
namespace.addVariable({
    componentOf: cityNode,
    nodeId: `s=${city_name}-Humidity`,
    browseName: "Humidity",
    dataType: "Double",
    value: {  get: function () { return extract_value(opcua.DataType.Double,city_name,"humidity"); } }
});
namespace.addVariable({
    componentOf: cityNode,
    nodeId: `s=${city_name}-Pressure`,
    browseName: "Pressure",
    dataType: "Double",
    value: {  get: function () { return extract_value(opcua.DataType.Double,city_name,"pressure"); } }
});
namespace.addVariable({
    componentOf: cityNode,
    nodeId: `s=${city_name}-Weather`,
    browseName: "Weather",
    dataType: "String",
    value: {  get: function () { return extract_value(opcua.DataType.String,city_name,"weather"); } }
});
```

### testing the server

It is now time to start the server for testing.

```sh
node weather.js
```

Putting everything together, the ```weather.js`` script looks like:
