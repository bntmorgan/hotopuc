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
var extend = require('extend')
var fs = require('fs')

var v = false
var verbose = function(s, l) {
  if (typeof(l)==='undefined') l = 'info';
  if (l == 'debug') {
    return
  }
  if (v) {
    process.stdout.write('[' + l + '] ')
    console.log(s)
  }
}

var error = function(s) {
  process.stdout.write('[error] ')
  console.log(s)
  process.kill()
}

function Rec(o) {
  this.name = o.name || 'John Doe'
  this.photos = o.photos || []
  this.birth_date = o.birth_date || []
  this.id = o.id || 0
}

function Match(o) {
  this.name = o.name || 'John Doe'
  this.photos = o.photos || []
  this.messages = o.messages || []
  this.id = o.id || 0
  this.mid = o.mid || 0
}

function Message(o) {
  this.m = o.m || ''
  this.from = o.from || ''
  this.to = o.to || ''
  this.date = o.date || ''
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
  this.tinder_id = '<tinder-id>'
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
  this.matches = {}
  this.recs = {}

  // Attributes
  this.v = false

  this.getRecsInfo = function(cb, o) {
    self.raw_recs.results.forEach(function(p) {
      verbose('Id : ' + p._id, 'debug')
      verbose('  name : ' + p.name, 'debug')
      verbose('  birth_date : ' + p.birth_date, 'debug')
      photos = []
      p.photos.forEach(function(ph) {
        verbose('  photo id : ' + ph.id, 'debug')
        verbose('    photo url : ' + ph.url, 'debug')
        photos.push(new Photo({'url': ph.url}))
      })
      self.recs[p._id] = new Rec({
        'name': p.name,
        'photos': photos,
        'birth_date': p.birth_daye,
        'id': p._id
      })
    })
    cb()
  }

  // Functions
  this.getRecs = function(cb, o) {
    var heads = extend({}, self.http_headers, {
      'X-Auth-Token': self.access_token
    })
    var options = {
      host: self.host,
      port: '443',
      path: '/recs',
      method: 'GET',
      headers: heads
    }

    // Set up the request
    var get_req = https.request(options, function(res) {
      res.setEncoding('utf8')
      var r = ""
      var end = function() {
        var t = eval('[' + r + ']')[0]
        if (t.results == undefined) {
          self.raw_recs = {results: []}
        } else {
          self.raw_recs = t
        }
        // Call the callback
        cb()
      }
      res.on('data', function (chunk) {
        r += chunk
      })
      res.on('end', end)
      res.on('close', end)
    })

    get_req.on('error', function(err) {
      throw 'error opening file: ' + err;
    })

    // get the data
    get_req.end()
  }

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
    matches = {}
    self.raw_matches.forEach(function(e) {
      var p = e.person
      verbose('Id : ' + p._id, 'debug')
      verbose('  name : ' + p.name, 'debug')
      photos = []
      p.photos.forEach(function(ph) {
        verbose('  photo id : ' + ph.id, 'debug')
        verbose('    photo url : ' + ph.url, 'debug')
        photos.push(new Photo({'url': ph.url}))
      })
      messages = []
      e.messages.forEach(function(m) {
        verbose('  msg id : ' + m._id, 'debug')
        verbose('  msg from : ' + m.from, 'debug')
        verbose('    msg text : ' + m.message, 'debug')
        messages.push(new Message({'m': m.message, 'from': m.from, 'to': m.to,
            'date': m.sent_date}))
      })
      matches[p._id] = new Match({
        'name': p.name,
        'photos': photos,
        'messages': messages,
        'id': p._id,
        'mid': e._id
      })
    })
    verbose('Matches before : ' + Object.keys(self.matches).length)
    verbose('Matches after : ' + Object.keys(matches).length)
    if (Object.keys(matches).length > Object.keys(self.matches).length) {
      console.log('You have new likes !!!')
    }
    self.matches = matches
    cb()
  }

  this.getRec = function(id) {
    if (self.recs[id] == undefined) {
      error('Unexisting match')
    }
    return self.recs[id]
  }

  this.getMatch = function(id) {
    if (self.matches[id] == undefined) {
      error('Unexisting match')
    }
    return self.matches[id]
  }

  // Save the matches into a cache file DB
  this.cacheLoad = function(cb, o) {
    fs.readFile(".matchesDB",  null, function(err, b) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      self.matches = eval('[' + b + ']')[0]
      fs.readFile(".recsDB",  null, function(err, b) {
        if (err) {
          throw 'error opening file: ' + err;
        }
        verbose("Cache loaded")
        self.recs = eval('[' + b + ']')[0]
        cb()
      })
    })
  }

  // Save the matches into a cache file DB
  this.cacheSave = function(cb, o) {
    fs.writeFile(".matchesDB", JSON.stringify(self.matches, null, 2),
        function(err) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      fs.writeFile(".recsDB", JSON.stringify(self.recs, null, 2),
          function(err) {
        if (err) {
          throw 'error opening file: ' + err;
        }
        verbose("Cache saved")
        cb()
      })
    })
  }

  this.messageSend = function(cb, o) {
    match = self.getMatch(o.id)
    verbose(match)
    verbose(o.m)
    verbose('Message sent !')

    var post_data = JSON.stringify({'message': o.m})
    var heads = extend({}, self.http_headers, {
      'X-Auth-Token': self.access_token,
      'Content-Length': Buffer.byteLength(post_data)
    })
    var options = {
      host: self.host,
      port: '443',
      path: '/user/matches/' + match.mid,
      method: 'POST',
      headers: heads
    }

    // Set up the request
    var post_req = https.request(options, function(res) {
      res.setEncoding('utf8')
      var r = ""
      var end = function() {
        var t = eval('[' + r + ']')[0]
        verbose(t)
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

  // Print a match
  this.printMatch = function(cb, o) {
    verbose("Chick id : " + o.id)
    match = self.getMatch(o.id)
    console.log(match.name + ' :')
    match.messages.forEach(function(m) {
      if (self.tinder_id == m.from) {
        console.log('  [' + m.date + ']me- ' + m.m)
      } else {
        console.log('  [' + m.date + ']boobz- ' + m.m)
      }
    })
    cb()
  }

  // Print all recs
  this.printAllRecs = function(cb, o) {
    for (var k in self.recs) {
      console.log('[' + k + ']: ' + self.recs[k].name)
    }
    cb()
  }

  // Print all matches
  this.printAllMatches = function(cb, o) {
    for (var k in self.matches) {
      console.log('[' + k + ']: ' + self.matches[k].name)
    }
    cb()
  }

  this.extremMassLike = function(cb, o) {
    var recs = []
    for (var k in self.recs) {
      recs.push(k)
    }
    var rc = 0
    var lf = function() {
      if (rc < recs.length) {
        self.recLike(lf, {id: recs[rc]})
        rc++
      } else {
        cb()
      }
    }
    lf()
  }
  
  // Recs match
  this.recLike = function(cb, o) {

    // Get the rec
    r = self.getRec(o.id)

    verbose('Linking : ' + r.name)

    var heads = extend({}, self.http_headers, {
      'X-Auth-Token': self.access_token
    })
    var options = {
      host: self.host,
      port: '443',
      path: '/like/'+r.id,
      method: 'GET',
      headers: heads
    }

    // Set up the request
    var get_req = https.request(options, function(res) {
      res.setEncoding('utf8')
      var r = ""
      var end = function() {
        var t = eval('[' + r + ']')[0]
        verbose('Remaining likes : ' + t.likes_remaining)
        // Call the callback
        cb()
      }
      res.on('data', function (chunk) {
        r += chunk
      })
      res.on('end', end)
      res.on('close', end)
    })

    get_req.on('error', function(err) {
      throw 'error opening file: ' + err;
    })

    // get the data
    get_req.end()
  }
  
  // Recs urls
  this.printAllRecsUrls = function(cb, o) {
    var recs = []
    if (o.id != undefined) {
      recs.push(self.getRec(o.id))
    } else {
      for (var k in self.recs) {
        recs.push(self.recs[k])
      }
    }
    fs.open(o.out, 'w', function(err, fd) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      var b = new Buffer('#!/bin/bash\n')
      fs.write(fd, b, 0, b.length, null, function() {
        var wf = function(mc, pc) {
          if (pc >= recs[mc].photos.length) {
            mc++
            pc = 0
          }
          if (mc < recs.length) {
            var b = new Buffer('wget "' + recs[mc].photos[pc].url + '" -O ' +
                recs[mc].name + '_' + pc + '.jpg\n')
            fs.write(fd, b, 0, b.length, null, function(a, b , c) {
              wf(mc, pc + 1)
            })
          } else {
            fs.close(fd, function() {
              cb()
            })
          }
        }
        wf(0, 0)
      })
    })
  }

  // Matches URLs
  this.printAllMatchesUrls = function(cb, o) {
    var matches = []
    if (o.id != undefined) {
      matches.push(self.getMatch(o.id))
    } else {
      for (var k in self.matches) {
        matches.push(self.matches[k])
      }
    }
    fs.open(o.out, 'w', function(err, fd) {
      if (err) {
        throw 'error opening file: ' + err;
      }
      var b = new Buffer('#!/bin/bash\n')
      fs.write(fd, b, 0, b.length, null, function() {
        var wf = function(mc, pc) {
          if (pc >= matches[mc].photos.length) {
            mc++
            pc = 0
          }
          if (mc < matches.length) {
            var b = new Buffer('wget "' + matches[mc].photos[pc].url + '" -O ' +
                matches[mc].name + '_' + pc + '.jpg\n')
            fs.write(fd, b, 0, b.length, null, function(a, b , c) {
              wf(mc, pc + 1)
            })
          } else {
            fs.close(fd, function() {
              cb()
            })
          }
        }
        wf(0, 0)
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
      ['c', 'chick=ARG'           ,'Set chick id'],
      ['L', 'like'                ,'Like the chick'],
      ['l', 'list'                ,'List all the matched chicks'],
      ['r', 'recs'                ,'List all the recommended chicks'],
      ['m', 'message=ARG'         ,'Send a message to the current chick'],
      ['p', 'print'               ,'Print a matched chick'],
      ['w', 'wget-matches=ARG'    ,'Compute wget script for match photo and write to file'],
      ['W', 'wget-recs=ARG'       ,'Compute wget script for match photo and write to file'],
      [null,'extrem-mass-like'    ,'Extrem mass like dude, the casual way'],
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

  verbose(self.f)
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
  this.chickId = null

  this.buildPipeline = function() {
    // Build the options
    self.options.doOptions(function(o) {
      // Build the pipeline
      if (o.verbose) {
        v = true
      }
      self.p.push(new Command({f: self.tinder.cacheLoad}))
      if (o.update) {
        self.p.push(new Command({f: self.tinder.getUpdates}))
        self.p.push(new Command({f: self.tinder.getMatchesInfo}))
        self.p.push(new Command({f: self.tinder.getRecs}))
        self.p.push(new Command({f: self.tinder.getRecsInfo}))
      }
      if (o.chick) {
        self.chickId = o.chick
        verbose('Match id selected is : ' + self.chickId)
      }
      if (o.print) {
        if (self.chickId == null) {
          error('Select your chick first')
        }
        self.p.push(new Command({f: self.tinder.printMatch, o: {id:
            self.chickId}}))
      }
      if (o.message) {
        if (self.chickId == null) {
          error('Select your chick first')
        }
        self.p.push(new Command({f: self.tinder.messageSend, o: {id:
            self.chickId, m: o.message}}))
      }
      if (o.list) {
        self.p.push(new Command({f: self.tinder.printAllMatches}))
      }
      if (o.recs) {
        self.p.push(new Command({f: self.tinder.printAllRecs}))
      }
      if (o['wget-recs']) {
        var opt = {out: o['wget-recs']}
        if (self.recId != null) {
          opt.id = self.recId
        }
        self.p.push(new Command({f: self.tinder.printAllRecsUrls, o: opt}))
      }
      if (o['wget-matches']) {
        var opt = {out: o['wget-matches']}
        if (self.chickId != null) {
          opt.id = self.chickId
        }
        self.p.push(new Command({f: self.tinder.printAllMatchesUrls, o: opt}))
      }
      if (o.like) {
        opt = {}
        if (self.chickId != null) {
          opt.id = self.chickId
        }
        self.p.push(new Command({f: self.tinder.recLike, o: opt}))
      }
      if (o['extrem-mass-like']) {
        self.p.push(new Command({f: self.tinder.extremMassLike}))
      }
      // Everytime in the end
      self.p.push(new Command({f: self.tinder.cacheSave}))
    })
  }

  this.execute = function(cb) {
    verbose("Pipeline start")
    var e = function() {
      if (self.p.length > 0) {
        self.p.shift().execute(e)
      } else {
        verbose("Pipeline end")
        cb()
      }
    }
    e()
  }
}

function main() {
  // Build pipeline
  p = new Pipeline(new Options(), new Tinder())
  p.buildPipeline()
  p.execute(function() {
    verbose('Goodbye')
  })
}

main()
