
var url = require("url")
var scgi = require("scgi-stream")
var xmlbuilder = require("xmlbuilder")
var async = require("async");
var xmlrpc = require("xmlrpc");
var xml2js = function (xml, callback) {
    var f = require('xml2js').parseString;

    f(xml, callback);
};



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
    var self = this;

    req.on("response", function(res) {
        var buff = "";
        res.on('data',function(data ) {
            buff += data;
        });
        res.on('end',function() {

            xml2js(buff, function (err, data) {
                try {
                    data = data.methodResponse;
                    if (data.fault)
                        callback(new Error('commande scgi foireuse : ' + JSON.stringify(self.getValue(data.fault[0].value[0]))));
                    else
                        callback(null, self.getValue(data.params[0].param[0].value[0]));
                } catch (e) {
                    callback(method+' : data not parsed : '+e+'\n'+buff);
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

Rtorrent.prototype.getValue = function(obj)
{
    var childname = Object.keys(obj)[0];
    obj = obj[childname][0];

    if (childname == 'i4')
        return parseInt(obj);
    else if (childname == 'i8')
        return parseInt(obj);
    else if (childname == 'string')
        return obj.trim();
    else if (childname == 'struct')
    {
        var res = {};
        obj = obj[Object.keys(obj)[0]];

        for (var i in obj)
        {
            name = obj[i][Object.keys(obj[i])[0]];
            value = this.getValue(obj[i][Object.keys(obj[i])[1]]);
            res[name] = value;
        }
        return res;
    }
    else if (childname == 'array')
    {
        obj = obj.data;

        var res = [];
        for (var i in obj)
        {
            for (var j in obj[i].value)
            {
                res.push(this.getValue(obj[i].value[j]));
            }
        }
        return res;

    }
    else
        throw new Error('type inconnu : ' +  childname);
}


Rtorrent.prototype.getMulticall = function(method, param, cmds, callback) {
    var self = this;
    var cmdarray = param;

    for (var c in cmds)
        cmdarray.push(cmds[c]+'=');

    self.get(method, cmdarray, function (err, data) {
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
    var self = this;
    var all = {};

    self.getTorrents(function (err, torrents) {
        if (err) return callback(err);

        async.parallel([function (ac) {

            self.getGlobal(ac);

        },function (ac) {

            self.getFreeDiskSpace(ac);

        },function (ac) {

            async.mapLimit(torrents, 2, function(torrent, asyncCallback) {
                self.getTorrentTrackers(torrent.hash, asyncCallback);
            }, ac);

        }, function (ac) {

            async.mapLimit(torrents, 2, function(torrent, asyncCallback) {
                self.getTorrentFiles(torrent.hash, asyncCallback);
            }, ac);

        }, function (ac) {

            async.mapLimit(torrents, 2, function(torrent, asyncCallback) {
                self.getTorrentPeers(torrent.hash, asyncCallback);
            }, ac);

        }], function (err, results) {
	    
	    if (err) return callback(err, results);

            all = results[0];
            all.torrents = torrents;
            all.freeDiskSpace = results[1];

            for (var t in torrents) {
                all.torrents[t].trackers = results[2][t];
                all.torrents[t].files = results[3][t];
                all.torrents[t].peers = results[4][t];
            }
            callback(err, all);

        });
        
    });
}


Rtorrent.prototype.getTorrents = function(callback) {
    var self = this;

    var cmds = {
        hash: 'd.get_hash',
        torrent: 'd.get_tied_to_file',
        torrentsession: 'd.get_loaded_file',
        path: 'd.get_base_path',
        name: 'd.get_base_filename',
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
        createdAt: 'd.creation_date',
        active: 'd.is_active',
        open: 'd.is_open',
        complete: 'd.get_complete',
        hashing: 'd.is_hash_checking',
        hashed: 'd.is_hash_checked',
        message: 'd.get_message',
        leechers: 'd.get_peers_accounted',
        seeders: 'd.get_peers_complete',
    };
    self.getMulticall('d.multicall', ['main'], cmds, function (err, data) {
        if (err) return callback(err);

        for (var i in data)
        {
            data[i]['state'] = '';
            if (data[i]['active'] == 1) data[i]['state'] += 'active ';
            if (data[i]['open'] == 1) data[i]['state'] += 'open ';
            if (data[i]['complete'] == 1) data[i]['state'] += 'complete ';
            if (data[i]['hashing'] == 1) data[i]['state'] += 'hashing ';
            if (data[i]['hashed'] == 1) data[i]['state'] += 'hashed ';
        }
        callback(err, data)
    });
}

Rtorrent.prototype.getTorrentTrackers = function(hash, callback) {
    var self = this;

    var cmds = {
        id: 't.get_id',
        group: 't.get_group',
        type: 't.get_type',
        url: 't.get_url',
        enabled: 't.is_enabled',
        open: 't.is_open',
        min_interval: 't.get_min_interval',
        normal_interval: 't.get_normal_interval',
        scrape_complete: 't.get_scrape_complete',
        scrape_downloaded: 't.get_scrape_downloaded',
        scrape_incomplete: 't.get_scrape_incomplete',
        scrape_time_last: 't.get_scrape_time_last',
    };

    self.getMulticall('t.multicall', [hash, ''], cmds, callback);
};

Rtorrent.prototype.getTorrentFiles = function(hash, callback) {
    var self = this;

    var cmds = {
        range_first: 'f.get_range_first',
        range_second: 'f.get_range_second',
        size: 'f.get_size_bytes',
        chunks: 'f.get_size_chunks',
        completed_chunks: 'f.get_completed_chunks',
        fullpath: 'f.get_frozen_path',
        path: 'f.get_path',
        priority: 'f.get_priority',
        is_created: 'f.is_created=',
        is_open: 'f.is_open=',
        last_touched: 'f.get_last_touched=',
        match_depth_next: 'f.get_match_depth_next=',
        match_depth_prev: 'f.get_match_depth_prev=',
        offset: 'f.get_offset=',
        path_components: 'f.get_path_components=',
        path_depth: 'f.get_path_depth=',
    };

    self.getMulticall('f.multicall', [hash, ''], cmds, callback);
}


Rtorrent.prototype.getTorrentPeers = function(hash, callback) {
    var self = this;

    var cmds = {
        address: 'p.get_address',
        client_version: 'p.get_client_version',
        completed_percent: 'p.get_completed_percent',
        down_rate: 'p.get_down_rate',
        down_total: 'p.get_down_total',
        id: 'p.get_id',
        port: 'p.get_port',
        up_rate: 'p.get_up_rate',
        up_total: 'p.get_up_total'
    };

    self.getMulticall('p.multicall', [hash, ''], cmds, callback);
}

Rtorrent.prototype.getGlobal = function(callback) {
    var self = this;

    var cmds = {
        up_rate: 'get_up_rate',
        down_rate: 'get_down_rate',
        up_total: 'get_up_total',
        down_total: 'get_down_total',
        bind: 'get_bind',
        check_hash: 'get_check_hash',
        dht_port: 'get_dht_port',
        directory: 'get_directory',
        download_rate: 'get_download_rate',
        http_cacert: 'get_http_cacert',
        http_capath: 'get_http_capath',
        http_proxy: 'get_http_proxy',
        ip: 'get_ip',
        max_downloads_div: 'get_max_downloads_div',
        max_downloads_global: 'get_max_downloads_global',
        max_file_size: 'get_max_file_size',
        max_memory_usage: 'get_max_memory_usage',
        max_open_files: 'get_max_open_files',
        max_open_http: 'get_max_open_http',
        max_peers: 'get_max_peers',
        max_peers_seed: 'get_max_peers_seed',
        max_uploads: 'get_max_uploads',
        max_uploads_global: 'get_max_uploads_global',
        min_peers_seed: 'get_min_peers_seed',
        min_peers: 'get_min_peers',
        peer_exchange: 'get_peer_exchange',
        port_open: 'get_port_open',
        upload_rate: 'get_upload_rate',
        port_random: 'get_port_random',
        port_range: 'get_port_range',
        preload_min_size: 'get_preload_min_size',
        preload_required_rate: 'get_preload_required_rate',
        preload_type: 'get_preload_type',
        proxy_address: 'get_proxy_address',
        receive_buffer_size: 'get_receive_buffer_size',
        safe_sync: 'get_safe_sync',
        scgi_dont_route: 'get_scgi_dont_route',
        send_buffer_size: 'get_send_buffer_size',
        session: 'get_session',
        session_lock: 'get_session_lock',
        session_on_completion: 'get_session_on_completion',
        split_file_size: 'get_split_file_size',
        split_suffix: 'get_split_suffix',
        timeout_safe_sync: 'get_timeout_safe_sync',
        timeout_sync: 'get_timeout_sync',
        tracker_numwant: 'get_tracker_numwant',
        use_udp_trackers: 'get_use_udp_trackers',
        max_uploads_div: 'get_max_uploads_div',
        max_open_sockets: 'get_max_open_sockets'
    };
    var cmdarray = [];

    for (var c in cmds)
        cmdarray.push(cmds[c]+'=');

    async.mapLimit(Object.keys(cmds), 1, function(key, asyncCallback) {
        self.get(cmds[key], [], asyncCallback);
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

Rtorrent.prototype.start = function(hash, callback) {
    var self = this;
    this.get('d.open', [hash], function(err, data) {
        if(err) return callback(err);

        self.get('d.start', [hash], callback);
    })
};

Rtorrent.prototype.stop = function(hash, callback) {
    var self = this;
    this.get('d.stop', [hash], function(err, data) {
        if(err) return callback(err);

        self.get('d.close', [hash], callback);
    })
};

Rtorrent.prototype.remove = function(hash, callback) {
    this.get('d.erase', [hash], callback);
};

Rtorrent.prototype.upload = function(filePath, callback) {
    this.get('load', [filePath, 'd.open=', 'd.start='], callback);
};

Rtorrent.prototype.remove = function(hash, callback) {
    this.get('d.erase', [hash], callback);
};

Rtorrent.prototype.setPath = function(hash, directory, callback) {
    this.get('d.set_directory', [hash, directory], callback);
};

Rtorrent.prototype.getFreeDiskSpace = function(callback) {
    var self = this;
    this.get('d.multicall', ['default', 'd.free_diskspace='], function(err, data) {
        if (err) return callback(err, {});
        
        var uniques = {};
        for (var i in data)
            uniques[data[i]] = data[i][0];

        var res = [];
        for (var i in uniques)
            res.push(uniques[i]);

        callback(err, res);
    });
};


module.exports = Rtorrent;





/*

$alldata['free_diskspace'] = disk_free_space('/home');

*/
