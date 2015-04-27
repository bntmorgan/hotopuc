#!/usr/bin/env node

/**
 * HoToPUC : fast tinder cli
 *
 * © Benoît Morgan 2015
 *
 * Thanks to
 * https://gist.github.com/rtt/10403467
 */

var https = require('https')
var fs = require('fs')
var extend = require('extend')
var fs = require('fs')

function Match(o) {
  this.name = o.name || 'John Doe'
  this.photos = o.photos || []
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
  // Save this
  
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
  this.blocks = null
  this.lists = null
  this.deleted_lists = null
  this.last_activity_date = null

  // Models

  this.matches = []
  // Functions

  this.getUpdates = function(cb) {
    var post_data = JSON.stringify({'last_activity_date':''})
    var heads = extend({}, self.http_headers, {
      'X-Auth-Token': self.access_token,
      'Content-Length': Buffer.byteLength(post_data)
    })
    var post_options = {
      host: self.host,
      port: '443',
      path: '/updates',
      method: 'POST',
      headers: heads
    }

    // Set up the request
    var post_req = https.request(post_options, function(res) {
      res.setEncoding('utf8')
      var r = ""
      var end = function() {
        var t = eval('[' + r + ']')[0]
        self.raw_matches = t.matches
        self.blocks = t.blocks
        self.lists = t.lists
        self.deleted_lists = t.deleted_lists
        self.last_activity_date = t.last_activity_date
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
      console.log(err)
    })

    // post the data
    post_req.write(post_data)
    post_req.end()
  }

  this.getMatchesInfo = function(cb) {
    self.raw_matches.forEach(function(e) {
      var p = e.person
      // console.log('Id : ' + p._id)
      // console.log('  name : ' + p.name)
      photos = []
      p.photos.forEach(function(ph) {
        // console.log('  photo id : ' + ph.id)
        // console.log('    photo url : ' + ph.url)
        photos.push(new Photo({'url': ph.url}))
      })
      self.matches.push(new Match({
        'name': p.name,
        'photos': photos
      }))
    })
    cb()
  }

  // Save the matches into a cache file DB
  this.cacheSave = function(cb) {
    fs.writeFile(".matchesDB", JSON.stringify(self.matches, null, 2), function(err) {
      if(err) {
        return console.log(err)
      }
      console.log("Cache saved")
      cb()
    })
  }

  this.printAllUrls = function(cb) {
    console.log('#!/bin/bash')
    self.matches.forEach(function(p) {
      p.photos.forEach(function(ph, i) {
        console.log('wget "' + ph.url + '" -O ' + p.name + '_' + i + '.jpg')
      })
    })
  }
}


function main(argv) {
  t = new Tinder()
  console.log("start")
  // setup database
  t.getUpdates(function() {
    t.getMatchesInfo(function() {
      t.cacheSave(function() {
        t.printAllUrls(function() {
          console.log("end")
        })
      })
    })
  })
}

main(process.argv)
