var http = require( "http" );
var express = require( "express" );
var socketIO = require( "socket.io" );
var path = require( "path" );
var fs = require( "fs" );
var open = require( "open" );

var serverFunction = function( _, anvil ) {
	return anvil.plugin( {
		name: "anvil.http",
		clients: [],
		commander: [
			[ "--host", "starts the http and socket servers" ],
			[ "--browser", "opens tab in your default browser" ]
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
			browser: false,
			paths: {
				"/": anvil.config.output
			}
		},
		events: {
			"socket.connected": [ socket ],
			"socket.disconnected": [ socket ]
		},

		addClient: function( socket ) {
			this.clients.push( socket );
			socket.on( "end", this.removeClient );
			anvil.log.event( "client connected" );
			this.raise( "socket.connected", socket );
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
			if( command.browser ) {
				this.config.browser = true;
			}
			if( command.host ) {
				this.app = express();
				this.app.use( express.bodyParser() );
				this.app.use( this.app.router );

				_.each( anvil.config['anvil.http'].paths, function( filePath, url ) {
					self.registerPath( url, filePath );
				} );

				anvil.registerPath = this.registerPath;

				if( anvil.plugins.compiler ) {
					var compilers = anvil.config.compiler.compilers;
					_.each( compilers, function( compiler, ext ) {
						var rgx = new RegExp( "/.*(" + ext + ")/" );
						self.app.get( rgx, self.compile );
					} );
				}

				var extPath = path.resolve( path.dirname( fs.realpathSync( __filename ) ), "../ext" ),
					port = anvil.config['anvil.http'].port;
				self.registerPath( "/anvil", extPath );
				this.server = http.createServer( this.app ).listen( port );
				this.socketServer = socketIO.listen( this.server );
				this.socketServer.set( "log level", 1 );
				this.socketServer.sockets.on( "connection", this.addClient );
				if( this.config.browser ) {
					open( "http://localhost:" + port + "/" );
				}

				anvil.on( "build.done", this.refreshClients );
			}
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
			anvil.log.debug( "registered " + url + " as " + filePath );
			this.app.use( url, express[ "static" ]( path.resolve( filePath ) ) );
		},

		removeClient: function( socket ) {
			var index = this.clients.indexOf( socket );
			if( index >= 0 ) {
				this.clients.splice( index, 1 );
				anvil.log.event( "client disconnected" );
				this.raise( "socket.disconnected", socket );
			}
		}
	} );
};

module.exports = serverFunction;