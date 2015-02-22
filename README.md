# node-rtorrent
control rtorrent with your nodejs project !


## Install rtorrent
check in config file (/home/user/.rtorrent.rc) that this line exist :

    scgi_port = 127.0.0.1:5000

now rtorrent is available (only from localhost) with scgi on :
    
    127.0.0.1:5000/


## set xmlrpc connexion mode
open apache config file and add :

    SCGIMount /RPC2 127.0.0.1:5000
    <Location "/RPC2">
        AuthType Basic
        AuthName "Rtorrent"
        AuthUserFile /home/www-data/.rtorrent-htpasswd
        Require valid-user
    </Location>

create a password file
    
    htpasswd -cb /home/www-data/.rtorrent-htpasswd user password

restart apache

    apachectl restart

now rtorrent is available with xmlrpc on

    user:password@server:80/RPC2


## Install
    npm install node-rtorrent


## Example
    var Rtorrent = require ('node-rtorrent');

    var rtorrent = new Rtorrent({
        mode: 'xmlrpc',
        host: 'yourserver',
        port: 80,
        path: '/RPC2'
        user: 'bob'
        pass: 'marley'
    });

    rtorrent.getAll(function (err, data) {
        if (err) return console.log('err: ', err);

        console.log(data);
        // data is : {torrents: [{hash: 'XXXXXX', name: 'ubuntu.iso', path: '/xxx', bitfield: ......... }, {...}], up_total: ...}
    });

    rtorrent.start('XXXXXXXX', function (err, data) {
        if (err) return console.log('err: ', err);

        console.log(data);
    });

    rtorrent.loadLink(...

    rtorrent.loadFile(...


and more : [Click here !](test.js)


## use from command line

    USAGE: node-rtorrent cmd ...

    Exemples:
        node-rtorrent download_list
        node-rtorrent d.multicall main d.name= d.get_base_path
        node-rtorrent t.multicall XXXXXXX t.id= t.url=
        node-rtorrent load "magnet:?xt=urn:xxxx"
        node-rtorrent load "http://xxx/xxx.torrent"
