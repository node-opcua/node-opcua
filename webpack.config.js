var path = require('path');

module.exports = {
  target: 'node',
  node: {
    __dirname: false
  },
  context: __dirname,
  entry: './index.js',
  output: {
    path: './',
    filename: 'bundle.js',
    libraryTarget: 'commonjs',
  },
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /(node_modules)/,
      loader: 'babel-loader'
    }, {
      test: /\.json$/,
      loader: 'json-loader'
    }]
  },
};
