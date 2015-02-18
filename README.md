# node-rtorrent
control rtorrent with your nodejs project !


## Install rtorrent
check in config file (/home/user/.rtorrent.rc) that this line exist :

    scgi_port = 127.0.0.1:5000

now rtorrent is available (only from localhost) with scgi on :
    
    127.0.0.1:5000/


## for xmlrpc connexion mode (optional)
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

## More examples

[Click here !](test.js)
