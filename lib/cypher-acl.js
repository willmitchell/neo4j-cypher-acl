"use strict";

var async = require('async');
var assert = require('assert');
var debug = require('debug')('CACL');
var request = require('superagent');
var status = require('http-status');

/**
 * Creates an instance of ACL.
 *
 * Examples:
 *   var acl = new graphACL(config);
 *
 * @constructor
 * @this {ACL}
 * @param config - A config to a graph database of your choice
 */
var ACL = function (config) {
  this.config = config;
};


/**
 * Create a query and submit it.  You must pass in valid Cypher, params, and a callback.
 *
 * @param qq The query, in Cypher.
 * @param params a map of parameters for the query
 * @param cb will be called with the response that must be unpacked by the caller.
 * @returns {Request}
 */
ACL.prototype.cypher = function (qq, params, cb) {

  var payload, url;
  if (params == null) {
    params = {};
  }
  url = this.config.neo4j.root_url + this.config.neo4j.path;
  //console.log("neo4j url: " + url);
  debug("cypher query: " + qq);
  payload = JSON.stringify({
    query: qq,
    params: params
  });
  debug("payload: " + payload);
  return request.post(url).send(payload).set("Accept", "application/json; charset=UTF-8").set("Content-Type", "application/json").end(function (err, res) {
    if (err) {
      return cb(err);
    }
    if (res.statusCode !== status.OK) {
      debug("warning: bad response code: " + res.statusCode);
    }

    debug("NEO response:" + res.text);
    var obj = JSON.parse(res.text);
    debug("NEO JSON:" + obj);
    cb(null, obj);
  });
};

ACL.prototype.create_user = function (uid, cb) {
  this.cypher('create (u:User { uid: {uid} } ) return id(u) as id', {uid: uid}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("CREATING user returned: " + JSON.stringify(res));

    var nodeid = res.data[0];
    cb(null, nodeid);
  });
};

ACL.prototype.warning_delete_all_nodes_and_edges = function (cb) {
  this.cypher('MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r return count(n) as count', {}, function (err, res) {
    if (err) {
      return cb(err);
    }
    debug("DELETE ALL NODES+EDGES returned: " + res);
    var col0 = res.columns[0];
    assert.equal(col0, 'count', "Count field of nodes deleted missing from result.");
    var count = res.data[0][0];
    if (count >= 0) {
      cb(null, count);
    }
  });
};


module.exports = ACL;
