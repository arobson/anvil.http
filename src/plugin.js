var express = require( "express" );
var socketIO = require( "socket.io" );
var path = require( "path" );

var serverFunction = function( _, anvil ) {
	return anvil.plugin( {
		name: "anvil.http",
		clients: [],
		commander: [
			[ "--host", "starts the http and socket servers" ]
		],
		config: {
			contentTypes: {
				".coffee": "application/javascript",
				".js": "application/javascript",
				".less": "text/css",
				".styl": "text/css",
				".sass": "text/css",
				".scss": "text/css",
				".md": "text/html",
				".markdown": "text/html",
				".haml": "text/html",
				".jade": "text/html"
			},
			port: 3080,
			paths: {
				"/": anvil.config.output
			}
		},

		addClient: function( socket ) {
			this.clients.push( socket );
			socket.on( "end", this.removeClient );
			anvil.log.event( "client connected" );
			anvil.events.raise( "socket.connected", socket );
		},

		compile: function( req, res ) {
			var fileName = "." + req.url;
				ext = path.extname( fileName ),
				mimeType = anvil.config['anvil.http'].contentTypes[ ext ];

			res.header( "Content-Type", mimeType );
			anvil.fp.read( fileName, function( content ) {
				var compiler = anvil.config.compiler.compilers[ ext ];
				compiler( content, function( compiled ) {
					res.send( compiled );
				} );
			} );
		},

		configure: function( config, command, done ) {
			var self = this;

			this.server = express.createServer();
			this.server.use( express.bodyParser() );
			this.server.use( this.server.router );

			_.each( anvil.config['anvil.http'].paths, function( filePath, url ) {
				self.registerPath( url, filePath );
			} );

			anvil.registerPath = this.registerPath;

			if( anvil.plugins.compiler ) {
				var compilers = anvil.config.compiler.compilers;
				_.each( compilers, function( compiler, ext ) {
					var rgx = new RegExp( "/.*(" + ext + ")/" );
					self.server.get( rgx, self.compile );
				} );
			}

			this.server.listen( anvil.config['anvil.http'].port );
			this.socketServer = socketIO.listen( this.server );
			this.socketServer.sockets.on( "connection", this.addClient );

			anvil.events.on( "build.done", this.refreshClients );
			done();
		},

		notifyClients: function( message, data ) {
			var self = this;
			_.each( this.clients, function( client ) {
				client.emit( message, data );
			} );
		},

		refreshClients: function() {
			anvil.log.event( "refreshing connected socket clients" );
			this.notifyClients( "refresh", {} );
		},

		registerPath: function( url, filePath ) {
			this.server.use( url, express[ "static" ]( path.resolve( filePath ) ) );
		},

		removeClient: function( socket ) {
			var index = this.clients.indexOf( socket );
			if( index >= 0 ) {
				this.clients.splice( index, 1 );
				anvil.log.event( "client disconnected" );
				anvil.events.raise( "socket.disconnected", socket );
			}
		}
	} );
};

module.exports = serverFunction;