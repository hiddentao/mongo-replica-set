# mongo-replica-set

[![NPM module](https://badge.fury.io/js/robe.png)](https://badge.fury.io/js/robe)

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
>>> Replica set ready
```

You can then (in a new terminal window) use `mongo` to connect to the sets, 
which should be running at `localhost:27117`, `localhost:27118` and 
`localhost:27119` respectively.

Press `CTRL+C` in the original window to terminate the instances and clean up 
the replica set.

If any errors occur during initialisation the command will exit and clean up 
the replica set instances and data folders.

### API

Base usage:

```js
var ReplicaSet = require('mongo-replica-set').ReplicaSet;

var rs = new ReplicaSet();

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
  verbose: true
});

rs.start();
```

## Contributing

Contributions are welcome! Please see `CONTRIBUTING.md`.

## LICENSE

MIT - see `LICENSE.md`.

