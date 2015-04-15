# mongo-replica-set

Command-line tool and API to quickly setup a MongoDB replica set for 
development purposes, based on the [official tutorial](http://docs.mongodb.org/manual/tutorial/deploy-replica-set-for-testing/).

## Installation

To use the API:

```bash
$ npm install mongo-replica-set
```

To use the command-line tool install globally:

```bash
$ npm install -g mongo-replica-set
```

## Usage

### Command-line

```bash
  Usage: mongo-replica-set [options]

  Options:

    -h, --help           output usage information
    -V, --version        output the version number
    -d, --data [folder]  Base folder for data storage (Default: auto-created folder in system temp folder)
    -n, --num [num]      No. of instances to launch (Default: 3)
    -p, --port [port]    Starting port number for instances (Default: 27117)
    -v, --verbose        Verbose output
```

Thus for a basic setup involving 3 `mongod` instances simply run:

```bash
$ mongo-replica-set
>>> Replica set ready: 127.0.0.1:27117, 127.0.0.1:27118, 127.0.0.1:27119
```

You can then (in a new terminal window) use `mongo` to connect to the instances, 
which should be running at `localhost:27117`, `localhost:27118` and 
`localhost:27119` respectively. Eg:

```bash
$ mongo --port 27117
MongoDB shell version: 2.6.5
connecting to: 127.0.0.1:27117/test
rs_515_1429031406166:PRIMARY> show dbs;
admin  (empty)
local  0.281GB
rs_515_1429031406166:PRIMARY> 
```
Press `CTRL+C` in the original window to terminate the instances and clean up 
the replica set.

_If any errors occur during initialisation the command will exit and clean up 
the replica set instances and data folders._

### API

Basic usage:

```js
var ReplicaSet = require('mongo-replica-set').ReplicaSet;

var rs = new ReplicaSet();

// returns a Promise
rs.start()
  .then(function() {
    // started ok.
  })
  .catch(function(err) {
    // something went wrong.
  });
```

You can pass options to the `ReplicaSet` constructor, similar to the command-line 
tool:

```js
var rs = new ReplicaSet({
  numInstances: 5,
  startPort: 55000,       
  baseFolder: '/opt/data',
  verbose: true,
  useColors: false   /* Don't use colours when outputting to console */
});

rs.start();
```

Once the replica set is running you can obtain the `hostname:port` connection 
strings:

```js
var conn = rs.getHosts();

// [ '127.0.0.1:55000', '127.0.0.1:55001', '127.0.0.1:55002']
``` 

## Contributing

Contributions are welcome! Please see `CONTRIBUTING.md`.

## LICENSE

MIT - see `LICENSE.md`.

