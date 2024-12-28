/* global module, __dirname */
var path = require('path');

var server;

module.exports = function(config) {
  return require("./redis");
  //return require(path.resolve(__dirname, '.', config.database));
};
