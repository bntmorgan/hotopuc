#!/usr/bin/env node

/**
 * HoToPUC : fast tinder cli
 *
 * © Benoît Morgan 2015
 *
 * Thanks to
 * https://gist.github.com/rtt/10403467
 */

var opt = require('node-getopt')
var https = require('https')
var fs = require('fs')
var extend = require('extend')
var fs = require('fs')

var v = false
var verbose = function(s) {
  if (v) {
    console.log(s)
  }
}


function Match(o) {
  this.name = o.name || 'John Doe'
  this.photos = o.photos || []
  this.id = o.id || 0
  this.mid = o.mid || 0
}

function Photo(o) {
  this.url = o.url || ''
}

// Authenticate
//
// Get fb token
//
// https://www.facebook.com/dialog/oauth?client_id=464891386855067&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=basic_info,email,public_profile,user_about_me,user_activities,user_birthday,user_education_history,user_friends,user_interests,user_likes,user_location,user_photos,user_relationship_details&response_type=token
//
// fb_token = '<fb-token>'
//
// Get fg id
//
// http://findmyfacebookid.com/
//
// fb_user_id="<id>"
//
// curl -v -X POST https://api.gotinder.com/auth \
//   -H "X-Auth-Token: $access_token" \
//   -H 'Content-Type: application/json' \
//   -H 'User-Agent: Tinder/3.0.4 (iPhone; iOS 7.1; Scale/2.00)' \
//   --data '{"facebook_token": "'$fb_token'", "facebook_id": "'$fb_user_id'"}'

function Tinder() {
  var self = this

  // Config

  this.host = 'api.gotinder.com' 
  this.fb_token = '<fb-token>'
  this.fb_user_id='<id>'
  this.access_token ='<access-token>' 
  this.http_headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Tinder/3.0.4 (iPhone; iOS 7.1; Scale/2.00)'
  }

  // Data
  this.raw_matches = null
  this.raw_blocks = null
  this.raw_lists = null
  this.raw_deleted_lists = null
  this.raw_last_activity_date = null

  // Models
  this.matches = []

  // Attributes
  this.v = false

  // Functions
  this.getUpdates = function(cb, o) {
    var post_data = JSON.stringify({'last_activity_date':''})
    var heads = extend({}, self.http_headers, {
      'X-Auth-Token': self.access_token,
      'Content-Length': Buffer.byteLength(post_data)
    })
    var options = {
      host: self.host,
      port: '443',
      path: '/updates',
      method: 'POST',
      headers: heads
    }

    // Set up the request
    var post_req = https.request(options, function(res) {
      res.setEncoding('utf8')
      var r = ""
      var end = function() {
        var t = eval('[' + r + ']')[0]
        self.raw_matches = t.matches
        self.raw_blocks = t.blocks
        self.raw_lists = t.lists
        self.raw_deleted_lists = t.deleted_lists
        self.raw_last_activity_date = t.last_activity_date
        // Call the callback
        cb()
      }
      res.on('data', function (chunk) {
        r += chunk
      })
      res.on('end', end)
      res.on('close', end)
    })

    post_req.on('error', function(err) {
      throw 'error opening file: ' + err;
    })

    // post the data
    post_req.write(post_data)
    post_req.end()
  }

  this.getMatchesInfo = function(cb, o) {
    self.raw_matches.forEach(function(e) {
      var p = e.person
      verbose('Id : ' + p._id)
      verbose('  name : ' + p.name)
      photos = []
      p.photos.forEach(function(ph) {
        verbose('  photo id : ' + ph.id)
        verbose('    photo url : ' + ph.url)
        photos.push(new Photo({'url': ph.url}))
      })
      self.matches.push(new Match({
        'name': p.name,
        'photos': photos,
        'id': p._id,
        'mid': e._id
      }))
    })
    cb()
  }

  // Save the matches into a cache file DB
  this.cacheLoad = function(cb, o) {
    fs.readFile(".matchesDB",  null, function(err, b) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      verbose("Cache loaded")
      self.matches = eval('[' + b + ']')[0]
      cb()
    })
  }

  // Save the matches into a cache file DB
  this.cacheSave = function(cb, o) {
    fs.writeFile(".matchesDB", JSON.stringify(self.matches, null, 2), function(err) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      verbose("Cache saved")
      cb()
    })
  }

  this.printAllUrls = function(cb, o) {
    fs.open(o.out, 'w', function(err, fd) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      var b = new Buffer('#!/bin/bash\n')
      fs.write(fd, b, 0, b.length, null, function() {
        var xxx = ""
        self.matches.forEach(function(p) {
          p.photos.forEach(function(ph, i) {
            xxx += 'wget "' + ph.url + '" -O ' + p.name + '_' + i + '.jpg\n'
          })
        })
        b = new Buffer(xxx)
        fs.write(fd, b, 0, b.length, null, function(a, b , c) {
          fs.close(fd, function() {
            cb()
          })
        })
      })
    })
  }
}

function Options() {
  var self = this

  // Run flags
  this.options = {}

  // Arguments
  this.doOptions = function(cb) {
    opt = require('node-getopt').create([
      ['v', 'verbose'             ,'Verbose output'],
      ['u', 'update'              ,'Recompute cache'],
      ['w', 'wget=ARG'            ,'Compute wget script and write to file'],
      ['h', 'help'                ,'display this help'],
      ['', 'version'              ,'show version']
    ])              // create Getopt instance
    .bindHelp()     // bind option 'help' to default action
    .parseSystem(); // parse command line
    self.options = opt.options
    cb(opt.options)
  }
}

function Command(options) {
  var self = this

  // Attributes
  this.f = options.f
  this.o = options.o

  // Methods
  this.execute = function(cb) {
    self.f(cb, self.o)
  }
}

function Pipeline(options, tinder) {
  var self = this

  // Attributes
  this.options = options
  this.tinder = tinder
  this.p = []

  this.buildPipeline = function() {
    // Build the options
    self.options.doOptions(function(o) {
      // Build the pipeline
      if (o.verbose) {
        v = true
      }
      if (o.update) {
        self.p.push(new Command({f: self.tinder.getUpdates}))
        self.p.push(new Command({f: self.tinder.getMatchesInfo}))
      } else {
        self.p.push(new Command({f: self.tinder.cacheLoad}))
      }
      if (o.wget) {
        self.p.push(new Command({f: self.tinder.printAllUrls, o: {out: o.wget}}))
      }
      // Everytime in the end
      if (true) {
        self.p.push(new Command({f: self.tinder.cacheSave}))
      }
    })
  }

  this.execute = function(cb) {
    verbose("start execute")
    var e = function() {
      if (self.p.length > 0) {
        self.p.shift().execute(e)
      } else {
        cb()
      }
    }
    e()
  }
}

function main() {
  verbose("Pipeline start")
  // Build pipeline
  p = new Pipeline(new Options(), new Tinder())
  p.buildPipeline()
  p.execute(function() {
    verbose("Pipeline end")
  })
}

main()
