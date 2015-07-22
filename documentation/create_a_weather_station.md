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

The server is written in Javascript, using [NodeJS](http://www.nodejs.org).

## retrieving Weather data using a REST API.

The virtual weather station need to extract the weather data from a web service.
[worldweatheronline](http://www.worldweatheronline.net/free-weather.aspx) provides a free API.
The Free API(http://cdn.worldweatheronline.net/docs/HTMLv11/index.html?usage_free_weather_api.htm) comes with some
restrictions, though, and only allows each user to make up to a maximum of 500 requests per hour, a.k.a 1 request every 7.2 second)


### getting a key at worldweatheronline

You will need to register to  [worldweatheronline](http://www.worldweatheronline.net/free-weather.aspx) to obtain
 your API key. Store you API key in a file name ```worldweatheronline.key```, in your project folder.


### testing the API

The API is documented [here](http://developer.worldweatheronline.com/documentation).

For example, typing the following URL in the address bar of your web browser.

```
http://api.worldweatheronline.com/free/v1/weather.ashx?q=London&format=json&key=<YOURAPIKEY>
```

will return the following JSON data

``` json
{
     "data": {
         "current_condition": [{
             "cloudcover": "75",
             "humidity": "67",
             "observation_time": "11:54 AM",
             "precipMM": "0.3",
             "pressure": "1003",
             "temp_C": "12",
             "temp_F": "54",
             "visibility": "10",
             "weatherCode": "116",
             "weatherDesc": [{
                 "value": "Partly Cloudy"
             }],
             "weatherIconUrl": [{
                 "value": "http:\/\/cdn.worldweatheronline.net\/images\/wsymbols01_png_64\/wsymbol_0002_sunny_intervals.png"
             }],
             "winddir16Point": "W",
             "winddirDegree": "260",
             "windspeedKmph": "31",
             "windspeedMiles": "19"
         }],
         "request": [{
             "query": "London, United Kingdom",
             "type": "City"
         }],
         "weather": [{
             "date": "2014-05-11",
             "precipMM": "2.5",
             "tempMaxC": "13",
             "tempMaxF": "56",
             "tempMinC": "5",
             "tempMinF": "41",
             "weatherCode": "266",
             "weatherDesc": [{
                 "value": "Light drizzle"
             }],
             "weatherIconUrl": [{
                 "value": "http:\/\/cdn.worldweatheronline.net\/images\/wsymbols01_png_64\/wsymbol_0017_cloudy_with_light_rain.png"
             }],
             "winddir16Point": "W",
             "winddirDegree": "267",
             "winddirection": "W",
             "windspeedKmph": "33",
             "windspeedMiles": "20"
         }]
     }
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
npm install request --save
npm install node-opcua --save
```

### accessing the _worldweatheronline_ API key

Our application will need to access our API developer key. Let's put it in a file named ```worldweatheronline.key``` in
our project folder. The key value can be easily read in nodejs using this code.

``` javascript
// read the World Weather Online API key.
var fs = require("fs");
var key = fs.readFileSync("worldweatheronline.key");
```

## testing the rest api

Lets write a small [demo.js](#testing the rest api "save:  | jshint"), to experiment the api.

Our purpose is to create a ```getCityWeather``` asynchronous function that pass to a callback function
an object containing the temperature and pressure of a city. This function will be used this way:

<!-- compile with literate-programming create_a_weather_station.md !-->

``` javascript
/*global require,console */
/*jshint evil:true */

_"getCityWeather"

var city = "London";

getCityWeather(city,function(err,data) {
    if (!err) {
        console.log(" city =",city);
        console.log(" time =",data.observation_time);
        console.log(" temperature =",    data.temperature);
        console.log(" pressure    =",    data.pressure);
    }
});

```

## getCityWeather

Let's write the method that reads the weather of a city.

``` javascript
_"accessing the _worldweatheronline_ API key"

function getCityWeather(city,callback) {

    var api_url="http://api.worldweatheronline.com/free/v1/weather.ashx?q="+city+"+&format=json&key="+ key;

    var options = {
        url: api_url,
        "content-type": "application-json",
        json: ""
    };

    var request = require("request");
    request(options, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var data  = perform_read(city,body);
        callback(null,data);
      } else {
        callback(error);
      }
    });
}

_"extract useful data"
```
### extract useful data

The ```perform_read``` function convert the raw json data retrieved from the API,into a simpler Javascript object for our application.

``` javascript
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
```

### reading data periodically

The Weather Station Server will have to query the weather data of a city on a regular basis. However, we have to be careful not to send too many queries to the web-server, as any exceeding requests will get rejected and will lead to a error:

``` html
<h1>Developer Over Rate</h1>
```

In NodeJs, the setInterval function can be used to perform a action periodically.

``` javascript
var london_data = {}
setInterval(function() {
   getCityWeather("London",function(err,data) {
       if (!err) {
            london_data = data;
       }
   });
}, 60*1000);
```

## making a round robin read

Why not make our server expose the weather variables of more than one city ?
Supposing we hold an array containing the city we want to monitore, our periodic call to the REST API will have to query the data for each city in turn.  We will store the most up to date weather data inside a map ```city_data_map``` .


Lets edit [demo2.js](#making a round robin read "save:  | jshint") to experiment this.

I chose 10 cities spread in different continents and hemisphere.

Just to make it fun, I added Longyearbyen, the [northenmost city in the world](http://en.wikipedia.org/wiki/Northernmost_cities_and_towns) and
'Ushuaia' one of the [southernmost city](http://en.wikipedia.org/wiki/Southernmost_cities_and_towns).


``` javascript
/*global require,setInterval,console */
var cities = [ 'London','Paris','New York','Moscow','Ho chi min','Benjing','Reykjavik' ,'Nouakchott','Ushuaia' ,'Longyearbyen'];

_"getCityWeather"

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

```


### Weather Server Skeleton

It is now time to create the skeleton of our weather server.


[weather.js](#Weather Server Skeleton "save:  | jshint")

```javascript
/*global require,console,setInterval */

_"making a round robin read"

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
       _"construct the address space"
    }
    construct_my_address_space(server);

    server.start(function() {
        console.log("Server is now listening ... ( press CTRL+C to stop)");
        console.log("port ", server.endpoints[0].port);
        
        var endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        console.log(" the primary server endpoint url is ", endpointUrl );
        
    });
}
server.initialize(post_initialize);
```



#### construct the address space

The server address space will be made of a ```Cities``` folder containing one folder for each city.


```javascript
// declare some folders
server.engine.addFolder("Objects",{ browseName: "Cities"});

function create_CityNode(city_name) {

    // declare the city node
    server.engine.addFolder("Cities",{ browseName: city_name });

    _"construct city weather variables"
}

cities.forEach(function(city) {
    create_CityNode(city);
});

_"extracting a DataValue"

```

#### extracting a DataValue

Let's write a helper function (```extract_value```) to extract a city weather variable as DataValue.
Since the city weather data are read asynchronously at a very low rate, it is possible that the data doesn't exist
yet when the client will send its request. We have to be careful to handle this case appropriately.
In the absence of city data, I have chose to send a BadUncertainInitalValue status code.

```javascript
function extract_value(city_name,property) {
    var city = city_data_map[city_name];
    if (!city) {
        return null;
    }
    var value = city[property];
    return new opcua.Variant({dataType: opcua.DataType.Double, value: value });
}
```

#### construct city weather variables

Each city node exposes 3 read-only variables that can be instantiated this way:

```javascript

server.engine.addVariable(city_name,{
    browseName: "Temperature",
    dataType: "Double",
    value: {  get: function () { return extract_value(city_name,"temperature"); } }
});
server.engine.addVariable(city_name,{
    browseName: "Humidity",
    dataType: "Double",
    value: {  get: function () { return extract_value(city_name,"humidity"); } }

});
server.engine.addVariable(city_name,{
    browseName: "Pressure",
    dataType: "Double",
    value: {  get: function () { return extract_value(city_name,"pressure"); } }
});
```

### testing the server

It is now time to start the server for testing.

``` sh
node weather.js
```


Putting everything together, the ```weather.js`` script looks like:
