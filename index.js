"use strict";

var _ = require('lodash'),
  debug = require('debug')('mongo-replica-set'),
  EventEmitter2 = require('eventemitter2').EventEmitter2,
  Q = require('bluebird'),
  mongodb = require('mongodb'),
  MongoClient = Q.promisifyAll(mongodb.MongoClient),
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
 * @constructor
 */
var ReplicaSet = exports.ReplicaSet = function(options) {
  EventEmitter2.call(this);

  this.processes = [];
  this.name = 'rs_' + parseInt(Math.random() * 1000) + '_' + Date.now();

  this.options = _.extend({
    numInstances: 3,
    startPort: 27117,
    baseFolder: path.join(shell.tempdir(), this.name),
  }, options);

};
util.inherits(ReplicaSet, EventEmitter2);




/**
 * Stop the replica set and delete all data.
 * @return {Promise}
 */
ReplicaSet.prototype.stop = function() {
  debug('Stopping replica set');

  this.processes.map(function(p) {
    p.kill();
  });

  shell.rm('-rf', this.options.baseFolder);

  this.emit('stopped');

  return Q.resolve();
};




/**
 * Initialise the replica set.
 * @return {Promise}
 */
ReplicaSet.prototype.start = function() {
  var self = this;

  debug('Initialise replica set ' + self.name);

  for (var i=0; i<self.options.numInstances; ++i) {
    var instanceDataFolder = path.join(self.options.baseFolder, 'data' + i);

    debug('Create data folder: ', instanceDataFolder);

    shell.mkdir('-p', instanceDataFolder);

    debug('Launch instance ' + i);

    self.processes.push(
      shell.exec(
        'mongod --port ' + (self.options.startPort + i) + ' --dbpath ' + instanceDataFolder + ' --replSet ' + self.name + ' --smallfiles --oplogSize 128',
        { 
          async: true,
          silent: true,
        }
      )
    );
  }

  self.emit('instances_launched');

  // connect to first instance to set things up
  return MongoClient.connectAsync('mongodb://127.0.0.1:' + self.options.startPort)
    .then(function(db) {
      debug('Connected to first instance');

      Q.promisifyAll(db);

      return db.evalAsync('rsconf = { _id: "' + self.name + '", members: [] }')
        .then(function() {
          return db.evalAsync('rs.initiate(rsconf)');
        })
        .then(function() {
          debug('Initiated replica set');

          // wait a few seconds for replica set to initiate
          return Q.timeout(3000);
        })
        .then(function() {
          debug('Add remaining instances to set');

          var promises = [];
          for (var i=1; i<self.options.numInstances; ++i) {
            promises.push(
              db.evalAsync('rs.add("127.0.0.1:' + (self.options.startPort + i) + '");')
            );
          }

          return Q.all(promises);
        })
        .then(function() {
          debug('Check replica set status');

          return db.evalAsync('rs.status();');
        })
        .then(function(data) {
          debug('Replica set ready: ' + JSON.stringify(data));

          self.emit('ready');
        });
    })
    .catch(function(err) {
      console.error(err);

      throw err;
    });
};




