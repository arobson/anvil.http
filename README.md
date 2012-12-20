## Anvil HTTP Extension
THIS EXTENSION IS OBSOLETE AND BEING ACTIVELY REPLACED BY CORE FEATURES IN 0.9.*

Provides an integrated web host using express and socket.io. Extends anvil with functionality to allow other extensions to host features and content.

This extension requires anvil.js version 0.9.* or greater.

## Installation

	anvil install anvil.http

## Usage

	anvil --host

	anvil --host --browser

### --browser
Automatically open a browser tab in your default browser pointed to the root url. Why? Because it's awesome.

## Configuration
Configuration can be changed by adding any of the three properties to the build file under "anvil.http": {}.

### "contentTypes"
A hash where the key is the extension of the requested file and the value is the mimeType specification. In general, this is only necessary if you're adding support for a file extension that needs to be compiled on the fly. 

Example:
	"contentTypes": { 
		".coffee": "application/javascript"
	}

### "port"
Specifies what port the server will listen to. The default is 3080.

Example:

	"port": 3080
			
### "paths"
A hash where the key is the relative url to map to a specific directory or file. The following example shows the default setting which causes the output directory to get mapped to the top level.

Example:
			
	"paths": {
		"/": anvil.config.output
	}

## API
Currently the only call that this extension adds to anvil is registerPath.

### registerPath( url, filePath )
This lets you register static files to serve at a specific relative url