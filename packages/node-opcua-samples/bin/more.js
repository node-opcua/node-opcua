#!/usr/bin/env node
"use strict";
/*
 * write a file to the console, preserving the Ansi color decoration
 */
const commandLineArgs = require("command-line-args");
const commandLineUsage = require("command-line-usage");

const optionDefinitions = [{ name: "file", defaultOption: true, type: String, description: "the file to write out" }];
const argv = commandLineArgs(optionDefinitions);
if (!argv.file) {
    console.log(commandLineUsage([{ header: "more", content: "Usage: more <file>" }, { header: "Options", optionList: optionDefinitions }]));
    process.exit(1);
}

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

const input = fs.createReadStream(argv.file);

readLines(input, func);
