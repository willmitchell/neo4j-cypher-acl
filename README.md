#neo4j-cypher-acl

[![Build Status](https://travis-ci.org/willmitchell/neo4j-cypher-acl.svg?branch=master)](https://travis-ci.org/willmitchell/neo4j-cypher-acl)

Neo4J Cypher ACL is a module that uses Neo4J and its Cypher query language to provide an Access Control Lists (ACL) solution.

This module was inspired by [npm package graph-acl](https://github.com/ydigital-factory/node-graph-acl).

The reason I decided to create something new was that I wanted to use Cypher in order to achieve a solution that scales to millions of nodes/edges.

Currently, almost all ACL-related methods involve a single request/reply cycle; this is hard to achieve with a generic (least common denominator)
type of approach that relies on multiple hops to traverse paths.

## Warning Regarding Testing

Currently, the test code will erase all nodes in the Neo4J database prior to running the tests.

## Short Example

```
var neo4j = require('node-neo4j');
var CACL = require('neo4j-cypher-acl');

var config = {
  neo4j: {
    root_url: process.env.NEO4J_ROOT_URL || "http://localhost:7474",
    path: "/db/data/cypher"
  }
};

var cacl = new CACL(config);

// TODO

});

```


## Install

To install the project and all its dependencies, you have to execute:
```
npm install neo4j-cypher-acl
```

## Tests

Tests are handled with [Mocha](http://mochajs.org/). To run them, you have to execute:
```
grunt test

```

## Documentation

JSDoc is used for the documentation of the project. To create it, you have to execute:
```
grunt doc
```

