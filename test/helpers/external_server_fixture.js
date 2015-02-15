require("requirish")._(module);
var colors = require("colors");
var crypto_utils = require("lib/misc/crypto_utils");
var path = require("path");
var _ = require("underscore");
/**
 *
 * @param options
 * @param callback {Function}
 * @param callback.error {Error|Null}
 * @param callback.data
 * @param callback.data.process
 * @param callback.data.endpointurl
 * @param callback.data.serverCertificate
 *
 */
function start_simple_server(options,callback) {

    if (_.isFunction(options)){
        callback=options; options = null;
    }

    options = options||{};

    var spawn = require("child_process").spawn;

    var options = {
        env: {}
    };

    _.extend(options.env,process.env);

    options.env.DEBUG = "ALL";

    var server_exec  = spawn('node', ['./bin/simple_server'],options);

    var serverCertificateFilename = path.join(__dirname,"../../certificates/server_cert_1024.pem");


    console.log(" node ","./bin/simple_server");

    function detect_early_termination(code,signal) {
        console.log('child process terminated due to receipt of signal '+signal);
        callback(new Error("Process has terminated unexepecdidally with code="+code+" signal="+signal));
    }
    var callback_called = false;

    function detect_ready_message(data) {
        if (!callback_called) {

            if ( /server now waiting for connections./.test(data))  {
                setTimeout(function(){

                    server_exec.removeListener("close",detect_early_termination);

                    callback(null,{
                        process: server_exec,
                        endpointUrl: "opc.tcp://localhost:26543/UA/SampleServer",
                        serverCertificate: crypto_utils.readCertificate(serverCertificateFilename)
                    });
                },100);
                callback_called=true;
            }
        }
    }
    server_exec.on('close', detect_early_termination);

    server_exec.on("error",function(err){
        console.log('XXXXX child process terminated due to receipt of signal ');
    });



    function dumpData(prolog,data) {
        data = "" + data;
        data = data.split("\n");

        data.filter(function(a) {return a.length>0}).forEach(function(data) {

            detect_ready_message(data);
            console.log(prolog + data);
        });

    }
    server_exec.stdout.on('data', function (data) {
        dumpData('stdout:  '.cyan ,data.toString('utf8'));
    });
    server_exec.stderr.on('data', function (data) {
        dumpData('stderr: '.red ,data.toString('utf8'));
    });

}

function stop_simple_server(serverHandle,callback) {

    // note : it looks like kill is not working on windows

    if(!serverHandle) {
        return  callback(null);
    }
    console.log(" SHUTTING DOWN : ",serverHandle.process.killed,serverHandle.process.pid);

    serverHandle.process.on("close",function(err){
        console.log('XXXXX child process terminated due to receipt of signal ');
        setTimeout(callback,100);
    });
    //serverHandle.process.on("error",function(err) {
    //    console.log('XXXXX child process terminated due to receipt of error ');
    //    setTimeout(callback,100);
    //});
    //setTimeout(function(){
    //    if (serverHandle.process.killed) {
    //        callback(err);
    //    }
    //});
    process.kill(serverHandle.process.pid,'SIGKILL');



}


exports.start_simple_server = start_simple_server;
exports.stop_simple_server = stop_simple_server;
