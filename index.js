"use strict";

var _ = require('lodash'),
  colors = require('colors'),
  fs = require('fs'),
  EventEmitter2 = require('eventemitter2').EventEmitter2,
  Q = require('bluebird'),
  path = require('path'),
  shell = require('shelljs'),
  spawn = require('cross-spawn'),
  util = require('util');




/**
 * A replica set.
 *
 * @param {Object} [options] Create options.
 * @param {Number} [options.numInstances] no. of instances to create (default is 3).
 * @param {Object} [options.startPort] Port number to start allocating at (default is 27117).
 * @param {Object} [options.baseFolder] Base folder for instance data (default is system temporary folder).
 * @param {Boolean} [options.verbose] Whether to log progress. Default is `false`.
 * @param {Boolean} [options.colors] Whether to use colours when outputting to console. Default is `false`.
 * @constructor
 */
var ReplicaSet = exports.ReplicaSet = function(options) {
  EventEmitter2.call(this);

  this.processes = [];
  this._hosts = [];
  this.name = 'rs_' + parseInt(Math.random() * 1000) + '_' + Date.now();

  this.options = _.extend({
    numInstances: 3,
    startPort: 27117,
    baseFolder: path.join(shell.tempdir(), this.name),
    verbose: false,
    useColors: false,
  }, options);
};
util.inherits(ReplicaSet, EventEmitter2);



ReplicaSet.prototype.getHosts = function() {
  return this._hosts;
};




ReplicaSet.prototype.log = function(msg) {
  if (!this.options.verbose) {
    return;
  }

  if (this.options.useColors) {
    msg = colors.green(msg);
  }

  console.log(msg);
};



ReplicaSet.prototype.logErr = function(msg) {
  if (this.options.useColors) {
    msg = colors.red(msg);
  }

  console.error(msg);
};



/**
 * Stop the replica set and delete all data.
 * @return {Promise}
 */
ReplicaSet.prototype.stop = function() {
  var self = this;

  self.log(1 < self.options.numInstances ? 'Stopping replica set' : 'Stopping host');

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

  var numInstances = self.options.numInstances;

  if (1 === numInstances) {
    self.log('Initialise single host');

    self._startHost(0)
  } else {
    self.log('Initialise replica set ' + self.name);

    _.times(self.options.numInstances, function(i) {
      self._startHost(i, self.name)
    });
  }

  // wait for processes to startup
  return Q.delay(1500)
    .then(function() {
      var killStatus = _.compact(_.pluck(self.processes, 'killed'));

      if (killStatus.length) {
        killStatus.map(function(ks) {
          self.logErr(ks.pid + ' exited with code ' + ks.code + ', signal: ' + ks.signal);
        });

        throw new Error('Some instances failed to launch');
      }
    })
    .then(function() {
      self.emit('instances_launched');

      var scriptPath = path.join(self.options.baseFolder, 'setup.js');

      if (1 < numInstances) {
        self.log('Creating shell script: ' + scriptPath);

        var lines = [
          'rs.initiate({ _id: "' + self.name + '", members: [ { "_id": 1, "host": "127.0.0.1:' + self.options.startPort + '"} ] });',
        ]
        for (var i=1; i<self.options.numInstances; ++i) {
          lines.push('rs.add("127.0.0.1:' + (self.options.startPort + i) + '");');
        }

        fs.writeFileSync(scriptPath, lines.join('\n'));

        self.log('Executing shell script');

        self._exec('mongo --port ' + self.options.startPort + ' ' + scriptPath, 'setup-output.txt');
      }

      self.log(1 < numInstances ? 'Checking replica status' : 'Checking host status');

      self._exec('mongo --port ' + self.options.startPort + ' --eval "JSON.stringify(rs.status());"', 'status-output.txt');

      self.log(1 < numInstances ? 'Replica set ready' : 'Host ready');

      self.emit('ready');
    });
};


ReplicaSet.prototype._startHost = function(hostNum, replicataSetName) {
  var self = this;

  var instanceDataFolder = path.join(self.options.baseFolder, 'data' + hostNum);

  self.log('Create data folder: ' + instanceDataFolder);

  shell.mkdir('-p', instanceDataFolder);

  self.log('Launch instance ' + hostNum);

  var port = (self.options.startPort + hostNum);

  var replicaOptions = replicataSetName ? ['--replSet', replicataSetName] : []

  var cmdString = [
    'mongod',
    '--port',
    port,
    '--dbpath',
    instanceDataFolder,
    '--smallfiles',
    '--oplogSize',
    128
  ].concat(replicaOptions)

  self.log(cmdString.join(' '));

  var childProcess = spawn(cmdString[0], cmdString.slice(1), {
    stdio: self.options.verbose ? 'pipe' : 'ignore'
  })

  childProcess.on('exit', function(code, signal) {
    childProcess.killed = {
      pid: childProcess.pid,
      code: code,
      signal: signal
    };
  });

  self._hosts.push('127.0.0.1:' + port);

  self.log('Launched instance (pid ' + childProcess.pid + ') listening on port ' + port + ', folder: ' + instanceDataFolder);

  self.processes.push(childProcess);
}


ReplicaSet.prototype._exec = function(command, outputFileName) {
  var outputFilePath = path.join(this.options.baseFolder, outputFileName);

  command += ' >> ' + outputFilePath;

  this.log(command);

  shell.exec(command);

  var lines = fs.readFileSync(outputFilePath).toString();
  this.log("---------------------\n" + lines + "---------------------");
};
