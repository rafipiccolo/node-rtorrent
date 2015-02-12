
var url = require("url")
var scgi = require("scgi-stream")
var xmlbuilder = require("xmlbuilder")
var xml2json = require("xml2json").toJson;
var async = require("async");


function Rtorrent(option) {
    this.host = (option && option['host']) || "127.0.0.1";
    this.port = (option && option['port']) || 5000;
    this.path = (option && option['path']) || "/";
}


Rtorrent.prototype.makeSCGIXML = function( method, param ) {
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

Rtorrent.prototype.get = function( method, params, callback ) {
    var content = this.makeSCGIXML(method, params)
    var req = scgi.request(this)

    req.on("response", function(res) {
        var buff = "";
        res.on('data',function(data ) {
            buff += data;
        });
        res.on('end',function( ) {
            data = xml2json(buff, {object:true}).methodResponse;

            if (data.fault)
                callback( {code: getValue(data.fault.value.struct.member[0].value), message: getValue(data.fault.value.struct.member[1].value) });
            else
                callback(null, getValue(data.params.param.value) );
        });
    })
    req.end(content)
};

Rtorrent.prototype.getAll = function(callback) {
    cmds = {
        'hash': 'd.get_hash=',
        'name': 'd.get_name=',
        'torrent': 'd.get_tied_to_file=',
        'torrentsession': 'd.get_loaded_file=',
        'path': 'd.get_base_path=',
        'name': 'd.get_base_filename=',
        'complete': 'd.get_complete=',
        'size': 'd.get_size_bytes=',
        'skip': 'd.get_skip_total=',
        'completed': 'd.get_completed_bytes=',
        'down_rate': 'd.get_down_rate=',
        'down_total': 'd.get_down_total=',
        'up_rate': 'd.get_up_rate=',
        'up_total': 'd.get_up_total=',
        'ratio': 'd.ratio=',
        'message': 'd.get_message=',
        'bitfield': 'd.get_bitfield=',
        'chunk_size': 'd.get_chunk_size=',
        'chunk_completed': 'd.get_completed_chunks=',
        'files': 'd.get_size_files=',
        'createdAt': 'd.creation_date=',
        'trackersnb': 'd.get_tracker_size=',
        'filesnb': 'd.get_size_files=',
        'active': 'd.is_active=',
        'open': 'd.is_open=',
        'hashing': 'd.is_hash_checking=',
        'hashed': 'd.is_hash_checked=',
        'message': 'd.get_message=',
        'state': 'd.get_state=',
        'peers': 'd.get_peers_accounted=',
    };

    var callarray = ['default'];
    for (var c in cmds)
        callarray.push(cmds[c]);

    this.get('d.multicall', callarray, function (err, torrents) {
        if (err) return callback(err);

        var res = [];
        var r = 0;
        for (var t in torrents)
        {
            res[r] = {};
            var i = 0;
            for (var c in cmds)
                res[r][c] = torrents[t][i++];
            r++;
        }

        callback(null, res);
    });
}


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

        for (var i in array)
            array[i] = getValue(array[i]);
        return array;
    }
    else
    {
        console.log('unknown value type : '+keys[0]);
        process.exit();
    }
}

module.exports = Rtorrent;





/*

var fields = {
  peers : ['p.get_address=', 'p.get_client_version=', 'p.get_completed_percent=', 'p.get_down_rate=', 'p.get_down_total=', 'p.get_id=', 'p.get_port=', 'p.get_up_rate=', 'p.get_up_total='],
  tracker : ['t.get_group=', 't.get_id=', 't.get_min_interval=', 't.get_normal_interval=', 't.get_scrape_complete=', 't.get_scrape_downloaded=', 't.get_scrape_time_last=', 't.get_type=', 't.get_url=', 't.is_enabled=', 't.is_open=', 't.get_scrape_incomplete='],
  system : ['get_bind', 'get_check_hash', 'get_dht_port', 'get_directory', 'get_download_rate', 'get_hash_interval', 'get_hash_max_tries', 'get_hash_read_ahead', 'get_http_cacert', 'get_http_capath', 'get_http_proxy', 'get_ip', 'get_max_downloads_div', 'get_max_downloads_global', 'get_max_file_size', 'get_max_memory_usage', 'get_max_open_files', 'get_max_open_http', 'get_max_peers', 'get_max_peers_seed', 'get_max_uploads', 'get_max_uploads_global', 'get_min_peers_seed', 'get_min_peers', 'get_peer_exchange', 'get_port_open', 'get_upload_rate', 'get_port_random', 'get_port_range', 'get_preload_min_size', 'get_preload_required_rate', 'get_preload_type', 'get_proxy_address', 'get_receive_buffer_size', 'get_safe_sync', 'get_scgi_dont_route', 'get_send_buffer_size', 'get_session', 'get_session_lock', 'get_session_on_completion', 'get_split_file_size', 'get_split_suffix', 'get_timeout_safe_sync', 'get_timeout_sync', 'get_tracker_numwant', 'get_use_udp_trackers', 'get_max_uploads_div', 'get_max_open_sockets'],
  files : ['f.get_completed_chunks=', 'f.get_frozen_path=', 'f.is_created=', 'f.is_open=', 'f.get_last_touched=', 'f.get_match_depth_next=', 'f.get_match_depth_prev=', 'f.get_offset=', 'f.get_path=', 'f.get_path_components=', 'f.get_path_depth=', 'f.get_priority=', 'f.get_range_first=', 'f.get_range_second=', 'f.get_size_bytes=', 'f.get_size_chunks=']
};


*/