"use strict";
const fs = require("fs");
const path = require("path");
const async = require("async");
const child_process = require("child_process");


const packages_folder = path.join(__dirname,"../packages");
const licence_file = path.join(__dirname,"../LICENSE");
const main_packagejson = path.join(__dirname,"../package.json");
const licence_text = "";
const main_package = {};

function do_on_folder2(folder,packagejson,callback) {

    const local_license_file = path.resolve(path.join(packages_folder,folder,"LICENSE"));
    console.log("package",packagejson);

    const local_package ={};
    async.series([

      function(callback) {
          fs.readFile(packagejson,"utf-8",function(err,data){
              local_package = JSON.parse(data);
              callback(err);
          });
      },
      function(callback) {
          local_package.description = main_package.description + " - module " + folder.replace("node-opcua-","");
          local_package.author = main_package.author;
          local_package.license = main_package.license;
          local_package.repository = main_package.repository;
          local_package.keywords = main_package.keywords;
          local_package.homepage = main_package.homepage;

          console.log(" local_package.description= ",local_package.description);
          fs.writeFile(packagejson,JSON.stringify(local_package,null," "),"utf-8",function(err){
              callback(err);
          });
      },
      function write_local_licence(callback) {
          fs.writeFile(local_license_file,licence_text,"utf-8",function(err){
              callback(err);
          });
      }
    ],callback);
}
function do_on_folder(folder,callback) {

    const package_file = path.resolve(path.join(packages_folder,folder,"package.json"));
    if (fs.existsSync(package_file)) {
        return do_on_folder2(folder,package_file,callback);
    }
    callback();
  
}
async.series([

  function readLicenceTxt(callback) {
    console.log("licence_file = ",licence_file);
      fs.readFile(licence_file,"utf-8",function(err,data){
          licence_text = data;
          callback(err);
      });
  },
    function read_main_packagejson(callback) {
        console.log("main_packagejson = ",main_packagejson);
        fs.readFile(main_packagejson,"utf-8",function(err,data){
            main_package = JSON.parse(data);
            callback(err);
        });
    },

  function (callback) {
      fs.readdir(packages_folder,{},function(err,files) {
          async.map(files,do_on_folder,function done(){
              callback();
          });
      });
  }
],function() {
    console.log("done");
});
