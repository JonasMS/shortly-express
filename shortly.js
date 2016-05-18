var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

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
app.use(session({secret: 'secret', rolling: true, authorized: false, cookie: {path: '/', maxAge: 300000}}));

app.get('/', 
function(req, res) {
  checkUser(req.session, res, () => res.render('index'));
});

app.get('/login',
function(req, res) {
  if (req.body.logout === 'true') {
    req.session.authorized = false;
  }
  res.render('login');
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.get('/create', 
function(req, res) {
  checkUser(req.session, res, () => res.redirect('login'));
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    checkUser(req.session, res, () => res.status(200).send(links.models));
    // req.session ? res.status(200).send(links.models) : res.redirect('/login');
  });
});

app.post('/login', 
function(req, res) {
  //redirected from logout button
  if (req.body.logout === 'true') {
    req.session.authorized = false;
    res.redirect('/login');
  } else {

    //login attempt
    new User({ username: req.body.username }).fetch().then(function(found) {
      //check if username is in users table
      if (found) {
        //check if username matches with password
          //pull password for given username, compare to given password
        if (bcrypt.compareSync(req.body.password, this.attributes.password)) {
          req.session.authorized = true;
          res.redirect('/');
          console.log('successful login');
        } else {
          console.log('login failed');
          res.redirect('http://localhost:4568/login');
        }
      } else {
        console.log('username not found in database');
        res.redirect('/login');
      }
    });

  }
});

// app.post('/logout', 
// function(req, res) {
//   console.log('session ended'); 
//   console.log('authorized?', req.session.authorized);
//   req.session.authorized = false;
//   res.redirect('/login');   
// });

app.post('/signup',
function(req, res) {
  new User({ username: req.body.username }).fetch().then(function(found) {
    //if username is available, add user to database
    if (!found) {
      var password = bcrypt.hashSync(req.body.password);
      this.save({username: req.body.username, password: password});
      console.log('created a new user');
      res.redirect('/');
    } else {
      prompt('username taken, try another');
      res.sendStatus(400);
    }
  });
});

app.post('/links', 
function(req, res) {
  checkUser(req.session, res, () => {
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
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
var checkUser = function(session, res, callback) {
  session.authorized ? callback() : res.redirect('/login');
};



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