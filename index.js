
var url = require("url")
var scgi = require("scgi-stream")
var xmlbuilder = require("xmlbuilder")
var async = require("async");
var xmlrpc = require("xmlrpc");
var xml2js = require("xml2js").parseString;

function Rtorrent(option) {
    this.mode = (option && option['mode']) || "scgi";
    this.host = (option && option['host']) || "127.0.0.1";
    this.port = (option && option['port']) || 5000;
    this.path = (option && option['path']) || "/";
    this.user = (option && option['user']) || null;
    this.pass = (option && option['pass']) || null;
    this.client = null;
    
    if (this.mode == 'xmlrpc')
    {
        options = {
            host: this.host,
            port: this.port,
            path: this.path,
            headers: {
                'User-Agent': 'NodeJS XML-RPC Client',
                'Content-Type': 'text/xml',
                'Accept': 'text/xml',
                'Accept-Charset': 'UTF8',
                'Connection': 'Close'
            }
        }

        if (this.user && this.pass) {
            options.basic_auth = {
                user: this.user,
                pass: this.pass
            }
        }

        client = xmlrpc.createClient(options);
    }
    else if (this.mode == 'scgi')
    {
    }
    else
    {
        throw new Error('unknown mode: '+this.mode+' (available: scgi/xmlrpc)');
    }
}

Rtorrent.prototype.get = function(method, param, callback) {
    if (this.mode == 'scgi')
        return this.getScgi(method, param, callback);
    else if (this.mode == 'xmlrpc')
        return this.getXmlrpc(method, param, callback);
}

Rtorrent.prototype.getXmlrpc = function(method, params, callback ) {
    client.methodCall(method, params, callback);
};

Rtorrent.prototype.getScgi = function(method, params, callback ) {
    var content = this.makeSCGIXML(method, params)
    var req = scgi.request(this)
    var realthis = this;

    req.on("response", function(res) {
        var buff = "";
        res.on('data',function(data ) {
            buff += data;
        });
        res.on('end',function() {
            xml2js(buff, function (err, data) {
                data = data.methodResponse;
                if (data.fault)
                    callback( {code: realthis.getValue(data.fault.value.struct.member[0].value), message: realthis.getValue(data.fault.value.struct.member[1].value) });
                else
                {
		    if (!data.params.length)
			callback(null, realthis.getValue(data.params.param.value) );
		    else
		    {
			var array = [];
			for (var i = 0; i < data.params.length; i++)
{
    console.log(data.params[i].param[0].value[0]);die();
			    array[i] = realthis.getValue(data.params[i].param[0].value[0]);
}
			callback(null, array);
		    }
                }
	    });
        });
    })
    req.end(content)
};

Rtorrent.prototype.makeSCGIXML = function(method, param ) {
    var root = xmlbuilder.create('methodCall')
    var methodName = root.ele("methodName", method)
    if ( typeof param == 'string' )
        param = [ param ] ;
    if ( param && param.length > 0 ) {
        var params = root.ele("params")
        for ( var i = 0 ; i < param.length ; i += 1 ) {
            var href = url.parse(param[i]).href
            params.ele("param").ele("value", href)
        }
    }
    return root.end({pretty:false})
}

Rtorrent.prototype.getValue = function(obj) {
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
            return this.getValue(array);

        for (var i in array)
            array[i] = this.getValue(array[i]);
        return array;
    }
    else
        throw new Error('unknown value type : '+keys[0]);
}


Rtorrent.prototype.getMulticall = function(method, param, cmds, callback) {
    var realthis = this;
    var cmdarray = param;

    for (var c in cmds)
        cmdarray.push(cmds[c]+'=');

    realthis.get(method, cmdarray, function (err, data) {
        if (err) return callback(err);

        var res = [];
        for (var d in data)
        {
            var i = 0;
            res[d] = {};
            for (var c in cmds)
                res[d][c] = data[d][i++];
        }

        callback(err, res);
    });
}

Rtorrent.prototype.getAll = function(callback) {
    var realthis = this;
    var all = {};

    realthis.getTorrents(function (err, torrents) {
        if (err) return console.log('err: ', err);

        async.parallel([function (ac) {

            realthis.getGlobal(ac);

        },function (ac) {

            async.mapLimit(torrents, 1, function(torrent, asyncCallback) {
                realthis.getTorrentTrackers(torrent, asyncCallback);
            }, ac);

        }, function (ac) {

            async.mapLimit(torrents, 1, function(torrent, asyncCallback) {
                realthis.getTorrentFiles(torrent, asyncCallback);
            }, ac);

        }], function (err, results) {

            all = results[0];
            all.torrents = torrents;

            for (var t in torrents) {
                all.torrents[t].trackers = results[1][t];
                all.torrents[t].files = results[2][t];
            }
            callback(err, all);

        });
        
    });
}


Rtorrent.prototype.getTorrents = function(callback) {
    var realthis = this;

    var cmds = {
        hash: 'd.get_hash',
        torrent: 'd.get_tied_to_file',
        torrentsession: 'd.get_loaded_file',
        path: 'd.get_base_path',
        name: 'd.get_base_filename',
        complete: 'd.get_complete',
        size: 'd.get_size_bytes',
        skip: 'd.get_skip_total',
        completed: 'd.get_completed_bytes',
        down_rate: 'd.get_down_rate',
        down_total: 'd.get_down_total',
        up_rate: 'd.get_up_rate',
        up_total: 'd.get_up_total',
        ratio: 'd.ratio',
        message: 'd.get_message',
        bitfield: 'd.get_bitfield',
        chunk_size: 'd.get_chunk_size',
        chunk_completed: 'd.get_completed_chunks',
        files: 'd.get_size_files',
        createdAt: 'd.creation_date',
        trackersnb: 'd.get_tracker_size',
        filesnb: 'd.get_size_files',
        active: 'd.is_active',
        open: 'd.is_open',
        hashing: 'd.is_hash_checking',
        hashed: 'd.is_hash_checked',
        message: 'd.get_message',
        state: 'd.get_state',
        leechers: 'd.get_peers_accounted',
        seeders: 'd.get_peers_complete',
    };
    realthis.getMulticall('d.multicall', ['main'], cmds, callback);
}

Rtorrent.prototype.getTorrentTrackers = function(torrent, callback) {
    var realthis = this;

    var cmds = {
        url: 't.get_url',
        min_interval: 't.get_min_interval',
        normal_interval: 't.get_normal_interval',
        scrape_complete: 't.get_scrape_complete',
        scrape_downloaded: 't.get_scrape_downloaded',
        scrape_incomplete: 't.get_scrape_incomplete',
        scrape_time_last: 't.get_scrape_time_last',
    };

    async.timesSeries(torrent.trackersnb, function(n, asyncCallback){
        realthis.getMulticall('t.multicall', [torrent.hash, n], cmds, asyncCallback);
    }, callback);
};

Rtorrent.prototype.getTorrentFiles = function(torrent, callback) {
    var realthis = this;

    var cmds = {
        range_first: 'f.get_range_first',
        range_second: 'f.get_range_second',
        size: 'f.get_size_bytes',
        chunks: 'f.get_size_chunks',
        completed_chunks: 'f.get_completed_chunks',
        fullpath: 'f.get_frozen_path',
        path: 'f.get_path',
        priority: 'f.get_priority',
    };

    async.timesSeries(torrent.filesnb, function(n, asyncCallback) {
        realthis.getMulticall('f.multicall', [torrent.hash, n], cmds, asyncCallback);
    }, callback);
}

Rtorrent.prototype.getGlobal = function(callback) {
    var realthis = this;

    var cmds = {
        up_rate: 'get_up_rate',
        down_rate: 'get_down_rate',
        up_total: 'get_up_total',
        down_total: 'get_down_total',
    };
    var cmdarray = [];

    for (var c in cmds)
        cmdarray.push(cmds[c]+'=');

    async.map(Object.keys(cmds), function(key, asyncCallback) {
        realthis.get(cmds[key], [], asyncCallback);
    }, function (err, data) {
        if (err) return callback(err);
        var res = {};

        var i = 0;
        for (var key in cmds) {
            res[key] = data[i++];
        };
        callback(err, res);
    });
}

module.exports = Rtorrent;





/*

var fields = {
  peers : ['p.get_address=', 'p.get_client_version=', 'p.get_completed_percent=', 'p.get_down_rate=', 'p.get_down_total=', 'p.get_id=', 'p.get_port=', 'p.get_up_rate=', 'p.get_up_total='],
  tracker : ['t.get_group=', 't.get_id=', 't.get_min_interval=', 't.get_normal_interval=', 't.get_scrape_complete=', 't.get_scrape_downloaded=', 't.get_scrape_time_last=', 't.get_type=', 't.get_url=', 't.is_enabled=', 't.is_open=', 't.get_scrape_incomplete='],
  system : ['get_bind', 'get_check_hash', 'get_dht_port', 'get_directory', 'get_download_rate', 'get_hash_interval', 'get_hash_max_tries', 'get_hash_read_ahead', 'get_http_cacert', 'get_http_capath', 'get_http_proxy', 'get_ip', 'get_max_downloads_div', 'get_max_downloads_global', 'get_max_file_size', 'get_max_memory_usage', 'get_max_open_files', 'get_max_open_http', 'get_max_peers', 'get_max_peers_seed', 'get_max_uploads', 'get_max_uploads_global', 'get_min_peers_seed', 'get_min_peers', 'get_peer_exchange', 'get_port_open', 'get_upload_rate', 'get_port_random', 'get_port_range', 'get_preload_min_size', 'get_preload_required_rate', 'get_preload_type', 'get_proxy_address', 'get_receive_buffer_size', 'get_safe_sync', 'get_scgi_dont_route', 'get_send_buffer_size', 'get_session', 'get_session_lock', 'get_session_on_completion', 'get_split_file_size', 'get_split_suffix', 'get_timeout_safe_sync', 'get_timeout_sync', 'get_tracker_numwant', 'get_use_udp_trackers', 'get_max_uploads_div', 'get_max_open_sockets'],
  files : ['f.get_completed_chunks=', 'f.get_frozen_path=', 'f.is_created=', 'f.is_open=', 'f.get_last_touched=', 'f.get_match_depth_next=', 'f.get_match_depth_prev=', 'f.get_offset=', 'f.get_path=', 'f.get_path_components=', 'f.get_path_depth=', 'f.get_priority=', 'f.get_range_first=', 'f.get_range_second=', 'f.get_size_bytes=', 'f.get_size_chunks=']
};

$cmds = array(
            't.get_url' => 'url',
            't.get_min_interval' => 'min_interval',
            't.get_normal_interval' => 'normal_interval',
            't.get_scrape_complete' => 'scrape_complete',
            't.get_scrape_downloaded' => 'scrape_downloaded',
            't.get_scrape_incomplete' => 'scrape_incomplete',
            't.get_scrape_time_last' => 'scrape_time_last',
        );
$cmds = array(
            'f.get_range_first' => 'range_first',
            'f.get_range_second' => 'range_second',
            'f.get_size_bytes' => 'size',
            'f.get_size_chunks' => 'chunks',
            'f.get_completed_chunks' => 'completed_chunks',
            'f.get_frozen_path' => 'fullpath',
            'f.get_path' => 'path',
        'f.get_priority' => 'priority',
        );
$cmds = array(
      'get_up_rate' => 'up_rate',
      'get_down_rate' => 'down_rate',
      'get_up_total' => 'up_total',
      'get_down_total' => 'down_total',
);

$alldata['free_diskspace'] = disk_free_space('/home');

*/
