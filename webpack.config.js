const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");
const babiliWebpackPlugin = require("babili-webpack-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");

// -------------------------------------------------------------
//
// -------------------------------------------------------------
const simple_client = {
    target: "node",
    context: __dirname,
    entry: {
        simple_server: "./packages/node-opcua-samples/bin/simple_server.js"
    },
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].bundle.js"
    },
    node: {
        __dirname: true,
        fs: "empty",
        net: "empty",
        child_process: "empty"
    },
    resolve: {
        // alias: {
        //     "node-opcua": "./node-opcua"
        // }
    },
    externals: [
        nodeExternals({
            //xx whitelist: [/opcua/]
        }),
        "node-opcua"
    ],

    module: {
        rules: [
            {
                test: /.*\.js/,
                loader: "shebang-loader"
            }
        ]
    },
    // "spawn-sync", "camelcase", "string-width", "read-pkg-up", "os-locale", "memcpy", "yargs", "ursa", "usage", "require-main-filename"],
    // module: {
    //     rules: [
    //         {
    //             test: /\.js$/,
    //             //xx exclude: [/node_modules/],
    //             loader: "babel-loader",
    //             query: {
    //                  presets: ["es2015"],
    //             },
    //         }
    //     ]
    // },
    plugins: [
        // new webpack.DllReferencePlugin({
        //     //context: path.join(__dirname, "dist", "dll"),
        //     manifest: require("./dist/opcua-manifest.json") // eslint-disable-line
        // }),
        //new MinifyPlugin({}/*minifyOpts*/, {}/*pluginOpts*/)
        // new webpack.optimize.UglifyJsPlugin({
        //      minimize: true,
        //      compress:true
        // })
        // new babiliWebpackPlugin({
        //     mangle: { "topLevel": true },
        //     deadcode: true
        // }),
    ]
};

module.exports = [simple_client];
