"use strict"
async = require("async")
assert = require("assert")
debug = require("debug")("CACL")
request = require("superagent")
status = require("http-status")

###*
Creates an instance of ACL.

Examples:
var acl = new graphACL(config);

@constructor
@this {ACL}
@param config - A config to a graph database of your choice
###
ACL = (config) ->
  @config = config
  return


###*
Create a query and submit it.  You must pass in valid Cypher, params, and a callback.

@param qq The query, in Cypher.
@param params a map of parameters for the query
@param cb will be called with the response that must be unpacked by the caller.
@returns {Request}
###
ACL::cypher = (qq, params, cb) ->
  payload = undefined
  url = undefined
  params = {}  unless params?
  url = @config.neo4j.root_url + @config.neo4j.path
  
  #console.log("neo4j url: " + url);
  debug "cypher query: " + qq
  payload = JSON.stringify(
    query: qq
    params: params
  )
  debug "payload: " + payload
  request.post(url).send(payload).set("Accept", "application/json; charset=UTF-8").set("Content-Type", "application/json").end (err, res) ->
    return cb(err)  if err
    debug "warning: bad response code: " + res.statusCode  if res.statusCode isnt status.OK
    debug "NEO response:" + res.text
    obj = JSON.parse(res.text)
    debug "NEO JSON:" + obj
    cb null, obj
    return



###*
A utility method that we use to clear the database before running tests.

@param cb
###
ACL::warning_delete_all_nodes_and_edges = (cb) ->
  @cypher "MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r return count(n) as count", {}, (err, res) ->
    return cb(err)  if err
    debug "DELETE ALL NODES+EDGES returned: " + res
    col0 = res.columns[0]
    assert.equal col0, "count", "Count field of nodes deleted missing from result."
    count = res.data[0][0]
    cb null, count  if count >= 0
    return

  return


###*
Create a user and return its Neo4J-node-id.  Note that the User is not currently populated with any interesting fields.
This is because the current usage model for this package is to complement existing MEAN stack implementations, where
MongoDB or some other backend handles Users and their metadata.

@param uid Some UID provided by an external system.  The only constraint is that it should be indexable by Neo.
@param cb
###
ACL::create_user = (uid, cb) ->
  @cypher "create (u:User { uid: {uid} }), (g:Group {name: \"/\"}), (u)-[:OWNS]->(g) return id(u) as uid, id(g) as gid",
    uid: uid
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING user returned: " + JSON.stringify(res)
    rval =
      uid: res.data[0][0]
      gid: res.data[0][1]

    debug "CREATING user unpacked object: " + JSON.stringify(rval)
    cb null, rval
    return

  return


###*
Get a User and their top level Groups.
@param uid a user id
@param cb
###
ACL::get_user = (uid, cb) ->
  @cypher "match (u:User {uid: {uid}}) optional match (g:Group), (u)-[:OWNS]-(g) return u.uid as uid",
    uid: uid
  , (err, res) ->
    return cb(err)  if err
    debug "get_user returned: " + JSON.stringify(res)
    rval = uid: false
    try
      uid = res.data[0][0]
      rval = uid: uid
    
    # NOP
    debug "get_user unpacked object: " + JSON.stringify(rval)
    cb null, rval
    return

  return


###*
Create a Group.  Groups can be used to aggregate sets of Assets and User Relationships.
@param uid the UID of a User node in Neo.
@param name the name of the group to create.
@param cb
###
ACL::create_group = (uid, name, cb) ->
  @cypher "match (u:User {uid: {uid} }) merge (g:Group {name: {name}}) merge (u)-[:OWNS]->(g) return id(g) as gid",
    name: name
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING group returned: " + JSON.stringify(res)
    nodeid = res.data[0]
    cb null, nodeid
    return

  return


###*
Add an Asset.  Put the method in the specified group, which must belong to the specified User/uid.

@param uid the UID of a User node in Neo.
@param aid an external id for an asset.
@param cb
###
ACL::add_asset = (uid, aid, name, cb) ->
  name = "/"  if name is `undefined`
  @cypher "match (u:User {uid: {uid}}), (g:Group {name: {name}}, (u)-[:OWNS*]->(g) merge (a:Asset {aid: {aid}}), (g)-[:OWNS]->(a) return id(a) as aid",
    uid: uid
    aid: aid
    name: name
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING Asset returned: " + res
    nodeid = res.data[0]
    cb null, nodeid
    return

  return

ACL::create_grant = (uid, name, cb) ->
  @cypher "match (u:User {uid: {uid}}) merge (g:Group {name: {name}}) merge (u)-[:OWNS]->(g) return id(g) as gid",
    name: name
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING group returned: " + JSON.stringify(res)
    nodeid = res.data[0]
    cb null, nodeid
    return

  return

ACL::put_asset_in_group = (uid, aid, name, cb) ->
  @cypher "match (u:User {uid: {uid} }) create (g:Group {name: {name}})",
    name: name
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING group returned: " + JSON.stringify(res)
    nodeid = res.data[0]
    cb null, nodeid
    return

  return

ACL::delete_user = (uid, cb) ->
  @cypher "match (u:User {uid: {uid} }) optional match (u)-[r:OWNS]->(x) delete r,u,x return true",
    uid: uid
  , (err, res) ->
    return cb(err)  if err
    debug "DELETE user returned: " + res
    rval = res.data[0][0]
    cb null, rval
    return

  return

gen_conn_key = ACL::gen_conn_key = (uid1, uid2) ->
  [
    uid1
    uid2
  ].sort().join ":"


###*
Created to escape callback hell.  Not intended for the public API

@param uid1
@param uid2
@param key
@param cb
@private
###
ACL::_create_conn_node = (uid1, uid2, key, cb) ->
  @cypher "match (u1:User {uid: {uid1}}), (u2:User {uid: {uid2}}), (c:Connection {key:{key}}) create unique u1-[:CONN]->c<-[:CONN]-u2  return u1,u2,c",
    uid1: uid1
    uid2: uid2
    key: key
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING Connection returned: " + res
    conn = res.data[0]
    cb null, conn
    return

  return


###*
When a User wishes to connect with another User, they send an invitation.  The invitation is essentially a
Connection object in an initial state.

@param uid1 the uid of the initiator
@param uid2 the uid of the recipient of the invitation
@param note a possibly blank message saying hello, etc.
@param cb
###
ACL::initiate_user_user_connection = (uid1, uid2, note, cb) ->
  key = gen_conn_key(uid1, uid2)
  self = this
  self.cypher "merge (c:Connection {key: {key}, note: {note}}) return id(c) as cid",
    key: key
    note: note
  , (err, res) ->
    return cb(err)  if err
    debug "CREATING Connection returned: " + res
    cid = res.data[0][0]
    assert.ok cid, "must have good cid"
    
    #cypher('start u1=node({uid1}), u2=node({uid2}), c=node({cid}) create unique u1-[:CONN]->c<-[:CONN]-u2  return u1,u2,c', {
    self._create_conn_node uid1, uid2, key, cb
    return

  return

ACL::list_connections_for_user = (uid, cb) ->
  query = "match (u:User {uid: {uid}})-[:CONN]->(c:Connection)<-[:CONN]-(u2:User) return id(u),id(c),id(u2),c.data"
  params = uid: uid
  @cypher query, params, (err, res) ->
    if err
      debug "error: " + err
      return cb(err)
    debug "conns_for_user: " + JSON.stringify(res)
    cb null, res
    return

  return

module.exports = ACL
