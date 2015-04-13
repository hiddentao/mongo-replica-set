"use strict";

var _ = require('lodash'),
  debug = require('debug')('mongo-replica-set'),
  fs = require('fs'),
  EventEmitter2 = require('eventemitter2').EventEmitter2,
  Q = require('bluebird'),
  mongodb = require('mongodb'),
  path = require('path'),
  shell = require('shelljs'),
  util = require('util');




/**
 * A replica set.
 * 
 * @param {Object} [options] Create options.
 * @param {Number} [options.numInstances] no. of instances to create (default is 3).
 * @param {Object} [options.startPort] Port number to start allocating at (default is 27117).
 * @param {Object} [options.baseFolder] Base folder for instance data (default is system temporary folder).
 * @param {Boolean} [options.logToConsole] Whether to log to console. Default is `false`.
 * @constructor
 */
var ReplicaSet = exports.ReplicaSet = function(options) {
  EventEmitter2.call(this);

  this.processes = [];
  this.name = 'rs_' + parseInt(Math.random() * 1000) + '_' + Date.now();

  this.options = _.extend({
    numInstances: 3,
    startPort: 27117,
    logToConsole: false,
    baseFolder: path.join(shell.tempdir(), this.name),
  }, options);

};
util.inherits(ReplicaSet, EventEmitter2);




/**
 * Stop the replica set and delete all data.
 * @return {Promise}
 */
ReplicaSet.prototype.stop = function() {
  var self = this;

  debug('Stopping replica set');

  return Q.map(self.processes, function(p) {
    // if not yet killed then kill and wait
    if (!p.killed) {
      return new Q(function(resolve, reject) {
        p.on('exit', function() {
          resolve();
        });

        p.kill();
      });
    } else {
      return true;
    }
  })
    .then(function() {
      shell.rm('-rf', self.options.baseFolder);

      self.emit('stopped');
    });
};




/**
 * Initialise the replica set.
 * @return {Promise}
 */
ReplicaSet.prototype.start = function() {
  var self = this;

  debug('Initialise replica set ' + self.name);

  _.times(self.options.numInstances, function(i) {
    var instanceDataFolder = path.join(self.options.baseFolder, 'data' + i);

    debug('Create data folder: ', instanceDataFolder);

    shell.mkdir('-p', instanceDataFolder);

    debug('Launch instance ' + i);

    var process = shell.exec(
      'mongod --port ' + (self.options.startPort + i) + ' --dbpath ' + instanceDataFolder + ' --replSet ' + self.name + ' --smallfiles --oplogSize 128',
      { 
        async: true,
        silent: !self.options.logToConsole,
      }
    );

    process.on('exit', function() {
      process.killed = true;
    });

    self.processes.push(process);    
  });

  // wait for processes to startup
  return Q.delay(2000)
    .then(function() {
      var killStatus = _.compact(_.pluck(self.processes, 'killed'));

      if (killStatus.length) {
        throw new Error('Some instances failed to launch');
      }
    })
    .then(function() {
      self.emit('instances_launched');

      var scriptPath = path.join(self.options.baseFolder, 'setup.js');

      debug('Creating shell script: ' + scriptPath);

      var lines = [
        'rs.initiate({ _id: "' + self.name + '", members: [ { "_id": 1, "host": "127.0.0.1:' + self.options.startPort + '"} ] });',
      ]
      for (var i=1; i<self.options.numInstances; ++i) {
        lines.push('rs.add("127.0.0.1:' + (self.options.startPort + i) + '");');
      }

      fs.writeFileSync(scriptPath, lines.join('\n'));

      debug('Executing shell script');

      self._exec('mongo --port ' + self.options.startPort + ' ' + scriptPath, 'setup-output.txt');

      debug('Checking replica status');

      self._exec('mongo --port ' + self.options.startPort + ' --eval "JSON.stringify(rs.status());"', 'status-output.txt');

      debug('Replica set ready');

      self.emit('ready');
    });
};



ReplicaSet.prototype._exec = function(command, outputFileName) {
  var suffix = '';
  if (!this.options.logToConsole) {
    var suffix = ' >> ' + path.join(this.options.baseFolder, outputFileName);
  } 

  shell.exec(command + suffix);
};




