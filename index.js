
var url = require("url")
var fs = require('fs');
var xmlrpc = require("xmlrpc");


function Rtorrent(option) {
    this.mode = (option && option['mode']) || "xmlrpc";
    this.host = (option && option['host']) || "127.0.0.1";
    this.port = (option && option['port']) || 80;
    this.path = (option && option['path']) || "/RPC2";
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

        this.client = xmlrpc.createClient(options);
    }
    else
    {
        throw new Error('unknown mode: '+this.mode+' (available: xmlrpc)');
    }
};

Rtorrent.prototype.get = function(method, param, callback) {
    return this.getXmlrpc(method, param, callback);
};

Rtorrent.prototype.getXmlrpc = function(method, params, callback ) {
    this.client.methodCall(method, params, callback);
};

Rtorrent.prototype.getMulticall = function(method, param, cmds, callback) {
    var self = this;
    var cmdarray = param;

    for (var c in cmds)
        cmdarray.push(cmds[c]+'=');

    self.get(method, cmdarray, function (err, data) {
        if (err) return callback(err);

        var res = doublearray2hash(data, Object.keys(cmds));
        callback(err, res);
    });
};

Rtorrent.prototype.getAll = function(callback) {
    var self = this;

    self.getGlobals(function (err, globals) {
        if (err) return callback(err);

        self.getTorrents(function (err, torrents) {
            if (err) return callback(err);

            var array = [];

            for (var t in torrents) {
                var params = [];
                params.push(torrents[t].hash);
                params.push('');
                for (var f in fields.files)
                    params.push(fields.files[f]+'=');
                array.push({'methodName': 'f.multicall', params: params})
            }

            for (var t in torrents) {
                var params = [];
                params.push(torrents[t].hash);
                params.push('');
                for (var f in fields.trackers)
                    params.push(fields.trackers[f]+'=');
                array.push({'methodName': 't.multicall', params: params})
            }

            for (var t in torrents) {
                var params = [];
                params.push(torrents[t].hash);
                params.push('');
                for (var f in fields.peers)
                    params.push(fields.peers[f]+'=');
                array.push({'methodName': 'p.multicall', params: params})
            }

            self.getXmlrpc('system.multicall', [array], function (err, data) {

                var nb = torrents.length;
                for (var i = 0; i < nb; i++)
                {
                    torrents[i]['files'] = doublearray2hash(data[i][0], Object.keys(fields.files));
                    torrents[i]['trackers'] = doublearray2hash(data[i+nb][0], Object.keys(fields.trackers));
                    torrents[i]['peers'] = doublearray2hash(data[i+nb+nb][0], Object.keys(fields.peers));
                }

                for (var t in torrents)
                    globals.free_disk_space = torrents[t].free_disk_space;

                globals.torrents = torrents;
                callback(err, globals)
            });
        });
    });
};

Rtorrent.prototype.getTorrents = function(callback) {
    var self = this;

    self.getMulticall('d.multicall', ['main'], fields.torrents, function (err, data) {
        if (err) return callback(err);

        for (var i in data)
        {
            data[i]['state'] = '';
            if (data[i]['active'] == 1)
                data[i]['state'] += 'active ';
            if (data[i]['open'] == 1)
                data[i]['state'] += 'open ';
            if (data[i]['complete'] == 1)
                data[i]['state'] += 'complete ';
            if (data[i]['hashing'] == 1)
                data[i]['state'] += 'hashing ';
            if (data[i]['hashed'] == 1)
                data[i]['state'] += 'hashed ';
            if (data[i]['down_total'] < data[i]['completed'])
                data[i]['down_total'] = data[i]['completed'];
            data[i]['ratio'] = data[i]['up_total']/data[i]['down_total'];
        }
        callback(err, data)
    });
};

Rtorrent.prototype.getTorrentTrackers = function(hash, callback) {
    this.getMulticall('t.multicall', [hash, ''], fields.trackers, callback);
};

Rtorrent.prototype.getTorrentFiles = function(hash, callback) {
    this.getMulticall('f.multicall', [hash, ''], fields.files, callback);
};

Rtorrent.prototype.getTorrentPeers = function(hash, callback) {
    this.getMulticall('p.multicall', [hash, ''], fields.peers, callback);
};

Rtorrent.prototype.systemMulticall = function(cmds, callback) {
    var array = [];

    for (i in cmds)
        array.push({
            'methodName': cmds[i],
            'params': [],
        });

    this.getXmlrpc('system.multicall', [array], function (err, data) {
        if (err) return callback(err);

        var res = {};
        var i = 0;
        for (var key in cmds)
            res[key] = data[i++][0];
        callback(err, res);
    });
};

Rtorrent.prototype.getGlobals = function(callback) {
   this.systemMulticall(fields.global, callback);
};

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

Rtorrent.prototype.loadLink = function(link, callback) {
    this.get('load_start', [link], callback);
};

Rtorrent.prototype.loadFile = function(filePath, callback) {
    var file = fs.readFileSync(filePath);
    this.get('load_raw_start', [file], callback);
};

Rtorrent.prototype.setPath = function(hash, directory, callback) {
    this.get('d.set_directory', [hash, directory], callback);
};

module.exports = Rtorrent;





var fields = {
    global: {
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
    },
    peers: {
        address: 'p.get_address',
        client_version: 'p.get_client_version',
        completed_percent: 'p.get_completed_percent',
        down_rate: 'p.get_down_rate',
        down_total: 'p.get_down_total',
        id: 'p.get_id',
        port: 'p.get_port',
        up_rate: 'p.get_up_rate',
        up_total: 'p.get_up_total'
    },
    files: {
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
    },
    trackers: {
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
    },
    torrents: {
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
        free_disk_space: 'd.free_diskspace',
    },
};



function array2hash(array, keys) {
    var i = 0;
    var res = {};
    for (var k in keys) {
        res[keys[k]] = array[i++];
    }
    return res;
}

function doublearray2hash(array, keys) {
    for (var i in array)
        array[i] = array2hash(array[i], keys);
    return array;
}
