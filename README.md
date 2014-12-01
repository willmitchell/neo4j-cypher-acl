#node-graph-acl

[![Build Status via Travis CI](https://travis-ci.org/ydigital-factory/node-graph-acl.svg?branch=master)](https://travis-ci.org/ydigital-factory/node-graph-acl)
[![Coverage Status via Coveralls](https://img.shields.io/coveralls/ydigital-factory/node-graph-acl.svg)](https://coveralls.io/r/ydigital-factory/node-graph-acl)
[![Dependency Status via Gemnasium](https://gemnasium.com/ydigital-factory/node-graph-acl.svg)](https://gemnasium.com/ydigital-factory/node-graph-acl)


Node Graph Cypher ACL is a module that uses Neo4J and the Cypher query language to provide support for
Access Control Lists (ACL).

This module was inspired by, and some of the implementation was borrowed from [npm package graph-acl](https://github.com/ydigital-factory/node-graph-acl).

The reason I decided to create something new was that I wanted to use Cypher and have a less generic (and chatty) connection to the graph database.

## Short Example

```
var neo4j = require('node-neo4j');
var ACL = require('neo4j-cypher-acl');

var config = {
  neo4j: {
    root_url: process.env.NEO4J_ROOT_URL || "http://localhost:7474",
    path: "/db/data/cypher"
  }
};
var myAcl = new CACL(config);

myACL.allow('admin', 'dashboard', ['create', 'read', 'update', 'delete'], function (err, success) {
  // Do something
});

```


## Install

To install the project and all its dependencies, you have to execute:
```
npm install node-graph-acl
```

## Tests

Tests are done with [Jasmine 2.0](http://jasmine.github.io/2.0/introduction.html). To run them, you have to execute:
```
grunt test
```

## Documentation

JSDoc is used for the documentation of the project. To create it, you have to execute:
```
grunt doc
```

