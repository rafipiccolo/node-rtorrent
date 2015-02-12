# rtorrent-scgi
connect to rtorrent via scgi and retrieve everything !

## Install
    npm install rtorrent-scgi;

## Example
    var Rtorrent = require ('rtorrent-scgi');

    var rtorrent = new Rtorrent({
        host: '127.0.0.1',
        port: 5000,
        path: '/'
    });

    rtorrent.get('d.name', ['XXXXXXXXXXXXXX'], function (err, data) {
        if (err) return console.log('err: ', err);

        console.log(data);
    });

## More examples

[Click here !](test.js)
