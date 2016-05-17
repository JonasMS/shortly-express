var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'secret', authorized: false, cookie: {path: '/', maxAge: 10000}}));


app.get('/', 
function(req, res) {
  req.session.authorized ? res.render('index') : res.redirect('http://localhost:4568/login');
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/successfullogin', 
function(req, res) {
  console.log('made it to successful login');
  res.redirect('http://localhost:4568/index');
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/create', 
function(req, res) {
  res.redirect('login');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    req.session.authorized ? res.status(200).send(links.models) : res.redirect('/login');
  });
});

app.post('/login', 
function(req, res) {
  console.log('sess', req.session);
  new User({ username: req.body.username }).fetch().then(function(found) {
    //check if username is in users table
    if (found) {
      //check if username matches with password
      if (req.body.username === this.attributes.password) {
        console.log('successful login');
        req.session.authorized = true;
        // app.use(session({secret: 'secret', cookie: {path: '/', maxAge: 60000}}));
        // res.end();
        res.redirect('/');
      } else {
        console.log('login failed');
        res.redirect('http://localhost:4568/login');
      }
      // console.log(this);
    } else {
      console.log('username not found in database');
      res.redirect('/login');
    }
  });
  
  
  //if user exists && username matches w/ paired password

  //else 
});

app.post('/signup',
function(req, res) {
  new User({ username: req.body.username }).fetch().then(function(found) {
    //if username is available, add user to database
    if (!found) {
      this.save({username: req.body.username, password: req.body.password});
      console.log('created a new user');
      res.redirect('/');
    } else {
      prompt('username taken, try another');
      res.end();
    }
  });
});

// var checkUser = function(req, res, next) {
//   //if user's cookie is valid
//     //direct them to desired address
//   //else
//     //redirect them to login

// };



app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);