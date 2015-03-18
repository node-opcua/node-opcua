#/bin/sh
BASEDIR=$(dirname $0)
echo ${BASEDIR}
cd ${BASEDIR}
../node_modules/literate-programming/bin/literate-programming.js  ./creating_a_client.md
../node_modules/literate-programming/bin/literate-programming.js  ./creating_a_server.md
../node_modules/literate-programming/bin/literate-programming.js  ./create_a_weather_station.md

