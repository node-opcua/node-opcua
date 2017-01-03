/*global module, require */
module.exports = function(Folder, args) {

    if (args.file.length === 0) {
        args.file = [
            "creating_a_client.md",
            "creating_a_server.md",
            "create_a_weather_station.md",
            "server_with_da_variables.md",
            "server_with_method.md",
            "creating_a_server_with_a_historizing_variable.md",
            "monitoring_home_temperature_with_a_rasberry.md",
        ];
    }
    args.build = ".";
    args.src = ".";

    require('litpro-jshint')(Folder, args);

};

