
var url = require("url")
var scgi = require("scgi-stream")
var xmlbuilder = require("xmlbuilder")
var xml2json = require("xml2json").toJson;
function Rtorrent(option) {
  this.host = (option && option['host']) || "127.0.0.1";
  this.port = (option && option['port']) || 5000;
  this.path = (option && option['path']) || "/";
}


Rtorrent.prototype.makeSCGIXML = function( method, param ) {
  var root = xmlbuilder.create('methodCall')
  var methodName = root.ele("methodName", method)
  if ( typeof param == 'string' ) param = [ param ] ;
  if ( param && param.length > 0 ) {
    var params = root.ele("params")
    for ( var i = 0 ; i < param.length ; i += 1 ) {
      var href = url.parse(param[i]).href
      params.ele("param").ele("value", href)
    }
  }
  return root.end({pretty:false})
}

Rtorrent.prototype.get = function( method, params, callback ) {
  if ( ! callback && typeof params == 'function' ) {
    callback = params;
    params = null;
  }
  content = this.makeSCGIXML(method, params)

  var req = scgi.request(this)
  req.on("response", function(res) {
    var buff = "";
    res.on('data',function(data ) {
      buff += data;
    });
    res.on('end',function( ) {
      data = xml2json(buff, {object:true}).methodResponse;
      console.log(JSON.stringify(data));

      if (data.fault)
	callback( {code: getValue(data.fault.value.struct.member[0].value), message: getValue(data.fault.value.struct.member[1].value) });
      else
        callback(null, getValue(data.params.param.value) );
    });
  })
  req.end(content)
};

function getValue(obj)
{
  var keys = Object.keys(obj);
  if (keys[0] == 'i4')
    return parseInt(obj[keys[0]]);
  else if (keys[0] == 'i8')
    return parseInt(obj[keys[0]]);
  else if (keys[0] == 'string')
    return obj[keys[0]];
  else if (keys[0] == 'array')
  {
    var array = obj[keys[0]].data.value;
    if (!array.length)
      return getValue(array);
    else
      for (var i in array)
        array[i] = getValue(array[i]);
    return array;
  }
  else
  {
    console.log('Mode inconnu : '+keys[0]);
    process.exit();
  }
}

module.exports = Rtorrent;
