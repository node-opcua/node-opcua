#!/usr/bin/env node
"use strict";
/*
 * write a file to the console, preserving the Ansi color decoration
 */
const argv = require("yargs")
    .usage("Usage: $0 <file>")
    .argv;

const fs = require("fs");


function readLines(input, func) {
    let remaining = "";

    input.on("data", function (data) {
        remaining += data;
        let index = remaining.indexOf("\n");
        while (index > -1) {
            const line = remaining.substring(0, index);
            remaining = remaining.substring(index + 1);
            func(line);
            index = remaining.indexOf("\n");
        }
    });

    input.on("end", function () {
        if (remaining.length > 0) {
            func(remaining);
        }
    });
}

function func(data) {
    console.log(data);
}

const input = fs.createReadStream(argv._[0]);

readLines(input, func);
