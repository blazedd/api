module.exports = function (database, callback) {
	//Imports
  var mongode = require('mongode');
  var ObjectID = require('mongode').ObjectID;
  var restify = require('restify');

  //Connect to database
  var db = mongode.connect(database);
  db.collection('plugins');
  db.collection('webstats');
  db.collection('geninfo');
  db.collection('authors');
  db.collection('categories');

  // Search Type Map
  var types = {
    '=': function (item, sub, reference) {
      reference[item['field']] = item['value'];
    },

    '!=': function (item, sub, reference) {
      reference[item['field']] = {
        '$ne': item['value']
      };
    },

    '<': function (item, sub, reference) {
      reference[item['field']] = {
        '$lt': item['value']
      };
    },

    '<=': function (item, sub, reference) {
      reference[item['field']] = {
        '$lte': item['value']
      };
    },

    '>': function (item, sub, reference) {
      reference[item['field']] = {
        '$gt': item['value']
      };
    },

    '>=': function (item, sub, reference) {
      reference[item['field']] = {
        '$gte': item['value']
      };
    },

    'like': function (item, sub, reference) {
      reference[item['field']] = new RegExp(item['value'], "i");
    },

    'exists': function (item, sub, reference) {
      reference[item['field']] = {
        '$exists': Boolean(item['value'])
      };
    },

    'in': function (item, sub, reference) {
      var list = [];
      for (i in item['value']) {
        list.push(new RegExp('^' + item['value'][i] + '$', "i"));
      }
      if (Object.prototype.toString.call(item['value']) === '[object Array]') {
        reference[item['field']] = {
          '$in': list
        }
      }
    },

    'not in': function (item, sub, reference) {
      var list = [];
      for (i in item['value']) {
        list.push(new RegExp('^' + item['value'][i] + '$', "i"));
      }
      if (Object.prototype.toString.call(item['value']) === '[object Array]') {
        reference[item['field']] = {
          '$nin': list
        }
      }
    },

    'all': function (item, sub, reference) {
      var list = [];
      for (i in item['value']) {
        list.push(new RegExp('^' + item['value'][i] + '$', "i"));
      }
      if (Object.prototype.toString.call(item['value']) === '[object Array]') {
        reference[item['field']] = {
          '$all': list
        }
      }
    },

    'and': function (item, sub, reference) {
      if (Object.prototype.toString.call(item['value']) === '[object Array]' && item['field'] == '') {
        reference['$and'] = (item['value'] == null ? sub : item['value']);
      }
    },

    'or': function (item, sub, reference) {
      if (Object.prototype.toString.call(item['value']) === '[object Array]' && item['field'] == '') {
        reference['$or'] = (item['value'] == null ? sub : item['value']);
      }
    },

    'likeor': function (item, sub, reference) {
      reference['$or'] = [];
      for (i in item['value']) {
        var key = Object.keys(item['value'][i])[0];
        reference['$or'][i] = {};
        reference['$or'][i][key] = new RegExp(item['value'][i][key], "i");
      }
    },

    'nor': function (item, sub, reference) {
      if (Object.prototype.toString.call(item['value']) === '[object Array]' && item['field'] == '') {
        reference['$nor'] = (item['value'] == null ? sub : item['value']);
      }
    },

    'not': function (item, sub, reference) {
      if (Object.prototype.toString.call(item['value']) === '[object Object]') {
        reference[item['field']] = { '$not' : (item['value'] == null ? sub : item['value']) };
      }
    } 
  };

  // Aliases
  types['equals'] = types['='];
  types['not-equals'] = types['!='];
  types['less'] = types['<'];
 	types['less-equal'] = types['<='];
  types['more'] = types['>'];
 	types['more-equal'] = types['>='];

  //Common methods
  var common = {
    fieldgen: function (fields, callback) {
      // Generates the field listing based on the include and exclude lists.
      var f = {
        '_id': 0
      }

      for (var i = 0, len = fields.length; i < len; i++) {
        if (fields[i] != '') {
          if (fields[i].charAt(0) == '-') {
            f[fields[i].substr(1)] = 0;
          } else {
            f[fields[i]] = 1;
          }
        }
      }

      callback(f);
    },

    list_geninfo: function (size, callback) {
      // Retrieves the last X number of generations based on the value of the size variable.
      if (size == undefined) {
        size = 1;
      }

      db.geninfo.find().sort('_id', -1).limit(size).toArray(function (err, docs) {
        for (var i in docs) {
          docs[i]['id'] = docs[i]['_id'];
          delete docs[i]['_id'];
        }

        callback(docs);
      });
    },

    get_geninfo: function (idnum, callback) {
      // Returns a specific generation ID's information.
      db.geninfo.findOne({
        '_id': ObjectID(idnum)
      }, function (err, document) {
        if (document != null) {
          document['id'] = document['_id'];
          delete document['_id'];
        } else {
          document = {};
        }

        callback(document);
      })
    },

    query: function (filters, fields, sort, start, size, callback) {
      // Generic query function to centralize querying the database.
      var d = 1;

      if (sort.charAt(0) == '-') {
        sort = sort.substr(1);
        d = -1;
      }

      common.fieldgen(fields, function (callback) {
        fields = callback;
      });

      if (size != undefined) {
        if (start == undefined) {
          start = 0;
        }

        db.plugins.find(filters, fields).sort(sort, d).skip(start).limit(size).toArray(function (err, docs) {
          callback(docs);
        });
      } else {
        db.plugins.find(filters, fields).sort(sort, d).toArray(function (err, docs) {
          if (err || docs == null) {
            return callback(null);
          }

          callback(docs);
        });
      }
    },

    list_plugins: function (server, fields, sort, start, size, callback) {
      // Returns a list of plugins with the field specified, the list can be narrowed down to specific server binary compatability by setting it to other than undefined.
      var filters = {
        'deleted': {
          '$exists': false
        }
      };

      if (server != undefined) {
        filters['server'] = server
      }

      common.query(filters, fields, sort, start, size, function (the_callback) {
        callback(the_callback);
      })
    },

    list_author_plugins: function (server, author, fields, sort, start, size, callback) {
      // Returns the plugin list for a given author. Can be filtered by server binary compatability using the server variable.
      var filters = {
        'authors': author
      };

      if (server != undefined) {
        filters['server'] = server
      }

      common.query(filters, fields, sort, start, size, function (the_callback) {
        callback(the_callback)
      })
    },

    list_category_plugins: function (server, category, fields, sort, start, size, callback) {
      // Returns the plugin list for a given category. Can be filtered by server binary compatability using the server variable.
      var filters = {
        'categories': category
      };

      if (server != undefined) {
        filters['server'] = server
      }

      common.query(filters, fields, sort, start, size, function (the_callback) {
        callback(the_callback)
      })
    },

    ca_convert: function (data, callback) {
      // Reformats the data to what the API should be returning.
      var dset = [];
      var item;

      for (var i = 0, dlen = data.length; i < dlen; i++) {
        item = data[i];

        dset.push({
          'name': item['_id'],
          'count': item['value']
        });
      }

      return callback(dset);
    },

    list_authors: function (callback) {
      // Returns a list of plugin authors and the number of plugins each one has created/worked on.
      db.authors.find().sort('_id').toArray(function (err, docs) {
        common.ca_convert(docs, function (the_callback) {
          callback(the_callback);
        })
      })
    },

    list_categories: function (callback) {
      // Returns a list of plugin categories and the count of plugins that fall under each category.
      db.categories.find().sort('_id').toArray(function (err, docs) {
        common.ca_convert(docs, function (the_callback) {
          callback(the_callback);
        })
      })
    },

    plugin_details: function (server, plugin, version, fields, callback) {
      // Returns the plugin details for a given plugin. Optionally will also return a specific version of the plugin in the versions list if something other than undefined is specified in the version variable.
      var filters = {
        'slug': plugin,
        'server': server
      };

      if (version != undefined && (version == 'release' || version == 'alpha' || version == 'beta')) {
        filters['versions.type'] = (version.charAt(0).toUpperCase() + version.slice(1));

        if (fields != '' && fields != null && fields.length != 0) {
          fields.push('versions.type');
        }
      }

      common.fieldgen(fields, function (callback) {
        fields = callback;
      });

      db.plugins.findOne(filters, fields, function (err, p) {
        if (err || p == null) {
          return callback(null);
        }
        var found = false;
        var the_versions = p['versions'];

        if (version != undefined && p['versions'] != null) {
          if (version.toLowerCase() == "latest") {
            the_versions = [p['versions'][0]];
          } else if (version.toLowerCase() == "alpha" || version.toLowerCase() == "beta" || version.toLowerCase() == "release") {
            for (var i = 0, versionsLen = p['versions'].length; i < versionsLen; i++) {
              if (p['versions'][i]['type'].toLowerCase() == version.toLowerCase()) {
                the_versions = [p['versions'][i]];
                found = true;
                break;
              }
            }

            if (!found) {
              the_versions = [];
            }
          } else {
            for (var i = 0, versionsLen = p['versions'].length; i < versionsLen; i++) {
              if (p['versions'][i]['version'] == version) {
                the_versions = [p['versions'][i]];
                found = true;
                break;
              }
            }

            if (!found) {
              the_versions = [];
            }
          }
        }

        p['versions'] = the_versions;
        callback(p);
      });
    },

    plugins_up_to_date: function (plugins_list, hash_list, file_list, server, callback) {
      // Takes a list of plugin slugs and returns an array of objects with the plugin and most recent version.
      var data = [];
      var slugs = [];

      if (plugins_list != '') {
	      for (var i = 0; i < plugins_list.length; i++) {
	        slugs.push({
	          'slug': plugins_list[i]
	        });
	      }
	    }

	    if (hash_list != '') {
	      for (var i = 0; i < hash_list.length; i++) {
	        slugs.push({ "versions" : { "$elemMatch": { "md5": hash_list[i] } } });
	      }
	    }

      if (file_list != '') {
        for (var i = 0; i < file_list.length; i++) {
          slugs.push({ "versions" : { "$elemMatch": { "filename": file_list[i] } } });
        }
      }

      db.plugins.find({
        '$or': slugs,
        'server': server
      }).toArray(function (err, docs) {
        var doc, versions, version;

        if (docs == null) {
        	return callback([]);
        }
        for (var i = 0, docLen = docs.length; i < docLen; i++) {
          doc = docs[i];
          versions = doc['versions'];

          var entry = {
            'slug': doc['slug'],
            'plugin_name': doc['plugin_name'],
            'versions': {
              'latest': {'version': versions[0]['version'], 'download': versions[0]['download'], 'md5': versions[0]['md5'] }
            },
          }
          if (hash_list && hash_list[i]) {
            entry.hash = hash_list[i];
          }
          if (file_list && file_list[i]) {
            entry.file = file_list[i];
          }

          for (var x = 0, versionLen = versions.length; x < versionLen; x++) {
            version = versions[x];

            if (version['type'] == 'Release' || version['type'] == 'Beta' || version['type'] == 'Alpha') {
              if (entry['versions'][version['type'].toLowerCase()] == null) {
                entry['versions'][version['type'].toLowerCase()] = { 'version': version['version'], 'download': version['download'], 'md5': version['md5'] };
              }
            }
            if (hash_list && hash_list[i] && hash_list[i] == version['md5']) {
              entry['versions']['current'] = { 'version': version['version'], 'download': version['download'], 'md5': version['md5'] };
            }
          }

          data.push(entry);
        }

        callback(data);
      })
    },

    plugin_search: function (filters, fields, sort, start, size, sub, callback) {
      // A generalized sort function for the database. 
      // Returns a list of plugins with the fields specified in the inclusion and exclusion variables.
      
      var f = {};
      var item;
      var action;

      if (sub == undefined) {
        sub = false;
      }

      for (var i = 0, filterLen = filters.length; i < filterLen; i++) {
        item = filters[i];
        action = item['action'];

        if (types[action]) {
          types[action](item, sub, f);
        }
      }

      if (sub) {
        return callback(f);
      }

      common.query(f, fields, sort, start, size, function (the_callback) {
        callback(the_callback);
      });
    }
  };

  //Initialize express app
  var app = restify.createServer();

  app.pre(restify.pre.userAgentConnection());
  app.pre(restify.pre.sanitizePath());

  var ALLOW_HEADERS = [
      'Accept',
      'Accept-Version',
      'Content-Length',
      'Content-MD5',
      'Content-Type',
      'Date',
      'Api-Version',
      'Response-Time',
      'Origin', 
      'X-Requested-With'
  ].join(', ');

  function setHeaders (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    if (res.methods && res.methods.length > 0) {
        if (res.methods.indexOf('OPTIONS') === -1) res.methods.push('OPTIONS');
        res.setHeader('Access-Control-Allow-Methods', res.methods.join(', '));
    }
  }

  function optionsHandler (req, res, next) {
    if (req.method.toLowerCase() === 'options') {
      setHeaders(req, res);
      res.send(204);
      next();
    } else {
      res.send(new restify.MethodNotAllowedError());
      next();
    }
  }

  app.on('MethodNotAllowed', optionsHandler);

  //Middleware
  app.use(function (req, res, next) {
    setHeaders(req, res);
    next();
  });
  app.use(restify.queryParser());
  app.use(restify.bodyParser())
  app.use(restify.jsonp());

  //Include api handlers
  require('./v3')(app, db, common);

  //Redirect
  app.get('/', function (req, res, next) {
    res.header('Location', '/3');
    res.send(302);
    next();
  });

  //Handle stats requests
  app.get('/stats/naughty_list', function (req, res, next) {
    db.plugins.find({ "_use_dbo": { "$exists": true } }, {
      '_id': 0,
      'slug': 1,
      'plugin_name': 1,
      'authors': 1,
    }).toArray(function (err, docs) {
      if (err) {
        res.send(500);
        return next();
      }

      res.send(docs);
      next();
    });
  });

  app.get('/stats/todays_trends', function (req, res, next) {
    db.plugins.find({}, {
      'slug': 1,
      'versions.version': 1
    }).toArray(function (err, plugins) {
      if (err) {
        res.send(500);
        return next();
      }

      var pcount = plugins.length;
      var vcount = 0;

      for (plugin in plugins) {
        vcount += plugins[plugin]['versions'].length;
      }

      res.send({
        'plugin_count': pcount,
        'version_count': vcount
      });
      next();
    });
  });

  app.get('/stats/trend/:days', function (req, res, next) {
    var filter = {
      '_id': 0,
      'plugins': 0
    };
    if (req.query.plugins) {
    	if (req.query.plugins == "all") { 
	      filter = { '_id': 0 }
    	} else {
	    	filter = { '_id': 0, 'timestamp': 1 }
		    var plugins = req.query.plugins.split(',');

		    for (var index = 0, pluginsLen = plugins.length; index < pluginsLen; index++) {
		      filter['plugins.' + plugins[index]] = 1;
		    }
	  	}
    }

    var days = (new Date().getTime() / 1000) - (86400 * req.params.days);
    db.webstats.find({ timestamp: { $gte: days } }, filter).sort('_id', -1).limit(parseInt(req.params.days)).toArray(function (err, docs) {
      if (err) {
        res.send(500);
        return next();
      }

      res.send(docs);
      next();
    });
  });

  //Deprecation stuff
  app.get('/2/bukkit/plugins', function (req, res, next) {
     res.send(['API', 'Deprecated', 'Please', 'update', 'your', 'software']);
     next();
  });

  app.get('/2/authors', function (req, res, next) {
    res.send(['API', 'Deprecated', 'Please', 'update', 'your', 'software']);
    next();
  });

  app.get('/2/categories', function (req, res, next) {
    res.send(['API', 'Deprecated', 'Please', 'update', 'your', 'software']);
    next();
  });

  app.get('/api2/bukkit/plugins', function (req, res, next) {
     res.send(['API', 'Deprecated', 'Please', 'update', 'your', 'software']);
     next();
  });

  app.get('/api2/authors', function (req, res, next) {
    res.send(['API', 'Deprecated', 'Please', 'update', 'your', 'software']);
    next();
  });

  app.get('/api2/categories', function (req, res, next) {
    res.send(['API', 'Deprecated', 'Please', 'update', 'your', 'software']);
    next();
  });

  app.get('/favicon.ico', function (req, res, next) {
    res.writeHead(204);
    res.end();
  });

  if (process.send != null) {
	  app.on('after', function (req, res, route, error) {
	    process.send({ res: { statusCode : res.statusCode }, req: { url: req.url }, route: route, error: error });
	  });
	}

	callback(app);
}
