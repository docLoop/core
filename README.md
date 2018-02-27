# docloop

docloop turns feedback into tasks, <br/>
converting online annotations of a document into issues in the author's bug tracking system.

For each platform you want to use with it you will need a separate adapter. 
The core module does not come with any real adapters, but here's two of them to install additionally:

* [PaperhiveAdapter](https://github.com/docloop/paperhive-adapter)
* [GithubAdapter](https://github.com/docloop/github-adapter)

With these two adapters in charge, docloop converts comments and replies of Paperhive documents into Github issues.

Check the example app at https://app.docloop.net

The core module and the two adapters are documented here: [documenation](https://docloop.github.io/docs)

## Requirements

docloop is built using node and published using npm.
To install it you need [Node.JS](https://nodejs.org).
To actually run it you will also need a [MongoDB](https://www.mongodb.com/) to connect to.


## Quick start

First of all get the core module:

    npm install docloop

Setup up a MongoDB and use its credentials in the following minimal example:

```javascript
var docloop         = require("docloop"),
    DocloopCore     = docloop.DocloopCore,
    DocloopAdapter  = docloop.DocloopAdapter,
    DocloopEndpoint = docloop.DocloopEndpoint

var docloopCore     = new DocloopCore({
                        port:     7777,
                        sessionSecret:  'abc',
                        db:{
                          name:     "your_db_name",
                          port:     27010,          //or wherever your db is running
                          user:     "your_db_user", //if authentication is required
                          pass:     "your_db_pass", //if authentication is required
                          address:  "127.0.0.1"     //or wherever your db is running
                        }
                      })

docloopCore
.use(DocloopAdapter,{
  id:       'custom-source-adapter',
  type:     'source',
  endpointClass:  DocloopEndpoint,
})
.use(DocloopAdapter,{
  id:       'custom-target-adapter',
  type:     'target',
  endpointClass:  DocloopEndpoint,
})
.run()
```

With this docloop is running on localhost:7777. Communication is works via http requests.

To actually see something you should get the client: [docloop-client](https://github.com/docloop/client)

Clone the repository and serve the SRC-directory (will improve on that in the future). Set the backendUrl in app.js or config.js to 
localhost:7777 and the app should work with the exmaple code above.

Alas, the example code doesnt do much. The DocloopAdapter is only the base class for custom adapters. It doesnt do really do anything on its own.
In Order have the example do anything useful you might want to install the above mentioned adpaters or write your own adapter class.

Using the paperhive-adapter is straight forward. The github-adapter however requires you to setup a [GithubApp](https://developer.github.com/apps/) beforehand.

The [exmaple app](https://app.docloop.net) uses the code from (docloop-backend)[https://github.com/docloop/backend].

Check the [documenation](https://docloop.github.io/docs) for configuration options of the two adapters.

