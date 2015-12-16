/*
 * write a file to the console, preserving the Ansi color decoration
 */
var argv = require('yargs')
    .usage('Usage: $0 <file>')
    .argv;

var fs = require("fs");


function readLines(input, func) {
    var remaining = '';

    input.on('data', function (data) {
        remaining += data;
        var index = remaining.indexOf('\n');
        while (index > -1) {
            var line = remaining.substring(0, index);
            remaining = remaining.substring(index + 1);
            func(line);
            index = remaining.indexOf('\n');
        }
    });

    input.on('end', function () {
        if (remaining.length > 0) {
            func(remaining);
        }
    });
}

function func(data) {
    console.log(data);
}

var input = fs.createReadStream(argv["_"][0]);

readLines(input, func);
