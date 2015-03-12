// ---------------------------------------------------------------------------------------------------------------------
// node-opcua
// ---------------------------------------------------------------------------------------------------------------------
// Copyright (c) 2014-2015 - Etienne Rossignon - etienne.rossignon (at) gadz.org
// ---------------------------------------------------------------------------------------------------------------------
//
// This  project is licensed under the terms of the MIT license.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so,  subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// ---------------------------------------------------------------------------------------------------------------------

var child_process = require("child_process");
var byline = require('byline');
var fs = require("fs");
var path = require("path");
var colors= require("colors");

function execute(cmd,callback){

    var output = "";
    var child = child_process.exec(cmd,function(err){
        //xx console.log("status = ", child.exitCode);
        callback(err,child.exitCode,output );
    });
    var stream1 = byline(child.stdout);
    stream1.on('data', function (line) {
        output += line + "\n";
        process.stdout.write("        stdout " + line.yellow + "\n");
    });
}

var cmd = path.join(__dirname,"./openssl/openssl.exe");

function check_openssl(callback) {

    console.log("checking presence of ",cmd);
    if (!fs.existsSync(cmd)) {
        return callback(null,false);
    }
    execute(cmd + " version", function(err,exitCode,output){
        if (err) {return callback(err);}
        callback(null, (exitCode === 0) && output.match(/ 1.0.2 /));
    });
}

var ProgressBar = require('progress');
var wget = require("wget-improved");

function download_openssl(callback) {

    var url    = "http://indy.fulgan.com/SSL/openssl-1.0.2-x64_86-win64.zip"
    var output_filename = path.basename(url);

    console.log("downloading " + url.yellow);
    if (fs.existsSync(output_filename)) {
        return callback(null,output_filename);
    }
    var options = {}
    var bar = new ProgressBar("[:bar]".cyan + " :percent ".yellow + ':etas'.white, {
        complete: '=',
        incomplete: ' ',
        width: 100,
        total: 100
    });

    var download = wget.download(url, output_filename, options);
    download.on('error', function(err) {
        console.log(err);
    });
    download.on('end', function(output) {
        console.log(output);
        console.log("done ...");
        callback(null,output_filename);
    });
    download.on('progress', function(progress) {
        bar.update(progress);
    });
}
function install_openssl(filename,callback) {
    dirPath = 'bin/openssl';

    var unzip = require("unzip");
    var stream = fs.createReadStream(filename);
    var unzipExtractor = unzip.Extract({ path: dirPath });
    stream.pipe(unzipExtractor);

    unzipExtractor.on("error",function(err) {
        callback(err);
    });
    unzipExtractor.on("close",function() {
        callback(null);
    })

}

exports.install_prerequisite = function(callback) {

    if (process.platform !== 'win32') {

        execute("which openssl",function(err,exitCode,output){
            if (exitCode !== 0 ) {
                console.log(" it seems that ".yellow + "openssl".cyan + " is not installed on your computer ".yellow);
                console.log("Please install it before running this programs".yellow);
                return callback(new Error("Cannot find openssl"));
            }
            return callback(null,output);
        });

    } else {

        check_openssl(function(err,openssl_ok) {

            if(err) {
                return callback(err);
            }
            if (!openssl_ok) {
                console.log("openssl seems to be missing and need to be installed".yellow);
                download_openssl(function(err,filename) {
                    if (!err) {
                        console.log("deflating ",filename.yellow);
                        install_openssl(filename,function(err){
                            console.log("verifying ",fs.existsSync(cmd) ? "OK ".green: " Error".red);
                            console.log("done ", err? err :"" );
                            callback(err);
                        });
                    }
                });

            } else {
                console.log("openssl is already installed and have the expected version.".green)
                callback(null);
            }
        });
    }
}

