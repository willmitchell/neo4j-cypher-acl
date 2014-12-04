var assert = require('assert');
var debug = require('debug')('CACL');
var request = require('superagent');
var status = require('http-status');

/**
 * Drive query/response processing with Neo4J.
 */
class QueryTemplate {

  //constructor(cb, query, params, name = "_", unpack = undefined) {
  constructor(x) {
    this.config = x.config;
    this.query = x.query;
    this.params = x.params;
    this.name = x.name;
    this.cb = x.cb;
    this.unpack = x.unpack;
  }

  payload() {
    var p = JSON.stringify({
      query: this.query,
      params: this.params
    });
    this.msg("sending payload: " + p);
    return p;
  }

  msg(s) {
    debug("[" + this.name + "]: " + s);
  }

  go() {
    return this.marshal();
  }

  /**
   * Create JSON and POST it to Neo4J.  Pass in a callback for the response.  Use Superagent for comms.
   *
   * @returns {request}
   */
  marshal() {
    let neo4j = this.config.neo4j;
    let url = neo4j.root_url + neo4j.path;

    let cb = (err, res)=> {
      this.unmarshal(err, res);
    };

    return request.post(url)
      .send(this.payload())
      .set("Accept", "application/json; charset=UTF-8")
      .set("Content-Type", "application/json")
      .end(cb);
  }

  /**
   * Take the raw JSON response and parse it to a JS object.  Pass that on to the handle method.
   * On err, the unmarshaling process is short-circuited.
   *
   * @param err
   * @param res
   * @returns {*}
   */
  unmarshal(err, res) {
    if (err) {
      return this.handle(err);
    }
    if (res.statusCode !== status.OK) {
      this.msg("warning: bad response code: " + res.statusCode);
    }

    this.msg("Raw response [..1024]:" + res.text.substring(0, 1024));
    var obj = JSON.parse(res.text);
    //this.msg("NEO JSON:" + obj);

    if (this.unpack !== undefined) {
      //this.msg("begin custom unpack");
      var rval = {success: false};

      try {
        rval = this.unpack(obj);
        rval.success = true;
      } catch (e) {
        this.msg("Exception in unpack.");
        rval.success = false;
      }
      this.handle(null, rval);
    } else {
      this.handle(null, obj);
    }
  }

  /**
   * Clients should probably override this to unpack results and adapt the network format into something
   * more app-specific.
   *
   * @param err
   * @param res
   */
  handle(err, res = {}) {
    var s = "upcall: ";
    if (err){
        s += "err: "+err ;
    }
    s += "res: "+JSON.stringify(res);
    this.msg(s);
    this.cb(err, res);
  }
}


module.exports = QueryTemplate;
