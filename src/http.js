var http;
var express;
var socketIO;
var open;

var path = require( "path" );
var fs = require( "fs" );
var url = require( "url" );

module.exports = function( _, anvil ) {

	var basePath = path.resolve( path.dirname( fs.realpathSync( __filename ) ), "../ext" );

	anvil.plugin( {
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
				".jade": "text/html",
				".html": "text/html"
			},
			port: 3080,
			browser: false,
			paths: {
				"/": anvil.config.output
			}
		},
		events: {
			"socket.connected": [ "socket" ],
			"socket.disconnected": [ "socket" ]
		},

		addClient: function( socket ) {
			var self = this;
			this.clients.push( socket );
			socket.on( "end", this.removeClient );
			anvil.log.event( "client connected" );
			this.emit( "socket.connected", { socket: socket } );
		},

		compile: function( req, res ) {
			var fileName = "." + req.url;
				ext = path.extname( fileName ),
				mimeType = this.config.contentTypes[ ext ];

			res.header( "Content-Type", mimeType );
			anvil.fp.read( fileName, function( content ) {
				var compiler = anvil.config[ "anvil.transform" ].compilers[ ext ];
				compiler( content, function( compiled ) {
					res.send( compiled );
				} );
			} );
		},

		configure: function( config, command, done ) {
			var self = this;
			http = require( "http" );
			express = require( "express" );
			socketIO = require( "socket.io" );
			open = require( "open" );
			if( command.browser ) {
				this.config.browser = true;
			}
			if( command.host ) {
				this.app = express();
				this.app.use( express.bodyParser() );
				this.app.use( this.app.router );
				this.app.use( this.injectControl );

				_.each( this.config.paths, function( filePath, url ) {
					self.registerPath( url, filePath );
				} );

				anvil.http = {
					registerPath: this.registerPath,
					open: this.open
				};

				if( anvil.extensions.plugins[ "anvil.transform" ] ) {
					var compilers = anvil.config[ "anvil.transform" ].compilers;
					_.each( compilers, function( compiler, ext ) {
						var rgx = new RegExp( "/.*(" + ext + ")/" );
						self.app.get( rgx, self.compile );
					} );
				}

				var extPath = path.resolve( basePath, "../ext" );
				self.registerPath( "/anvil", extPath );
				this.server = http.createServer( this.app ).listen( this.config.port );
				this.socketServer = socketIO.listen( this.server );
				this.socketServer.set( "log level", 1 );
				this.socketServer.sockets.on( "connection", this.addClient );
				//this.app.get( /[.]html$/, this.browserControl );
				if( this.config.browser ) {
					this.open();
				}

				anvil.on( "build.done", this.refreshClients );
				this.publish( "setup.complete", {} );
			}
			done();
		},

		injectControl: function( req, res, next ) {
			if (req.method !== "GET") {
				next();
				return;
			}
			var writeHead = res.writeHead,
				write = res.write,
				end = res.end,
				chunks = [],
				body,
				totalSize = 0,
				serve = function() {
					var original = body.toString();
					if( original.match( /[<][\/]body[>]/ ) ) {
						var modified = original.replace( /[<][\/]body[>]/,
							"<script src=\"/socket.io/socket.io.js\"></script>\n<script src=\"/anvil/buildHook.js\"></script>\n</body>"
						);
						res._headers[ "content-length" ] = modified.length;
						res.end( modified );
					} else {
						res.end( body );
					}
				};

			res.write = function( chunk, encoding ) {
				if ( typeof chunk === "string" ) {
					var length;
					if ( !encoding || encoding === 'utf8' ) {
						length = Buffer.byteLength( chunk );
					}
					var buffer = new Buffer( length );
					buffer.write( chunk, encoding );
					chunks.push( buffer );
				} else {
					chunks.push( chunk );
				}
				totalSize += chunk.length;
			};

			res.end = function( chunk, encoding ) {
				if ( chunk && chunk.length ) {
					res.write( chunk, encoding );
				}
				body = new Buffer( totalSize );
				var offset = 0;
				chunks.forEach( function( chunk ) {
					chunk.copy( body, offset );
					offset += chunk.length;
				});
				res.writeHead = writeHead;
				res.write = write;
				res.end = end;
				serve();
			};
			next();
		},

		notifyClients: function( message, data ) {
			var self = this;
			_.each( this.clients, function( client ) {
				client.emit( message, data );
			} );
		},

		open: function( path ) {
			var base = "http://localhost:" + this.config.port,
				full = _.isEmpty( path ) ? base  + "/" : base + path;
			open( full );
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
				this.emit( "socket.disconnected", { socket: socket } );
			}
		}
	} );
};