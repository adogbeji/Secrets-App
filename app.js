//jshint esversion:6

require("dotenv").config();
const express = require("express");
const fs = require("fs");
const https = require("https");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const InstagramStrategy = require("passport-instagram").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
  secret: "tryandguessme1067",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());  //This initialises 'passport' and allows us to start using it for authentication
app.use(passport.session());  //This tells our app to use 'passport' to set up our session

mongoose.connect("mongodb+srv://Admin_BA:Test_1993@cluster0-pntjw.mongodb.net/userDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  instagramId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://intense-journey-69692.herokuapp.com/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://intense-journey-69692.herokuapp.com/auth/facebook/secrets",
    profileFields: ["id", "name", "email"]  //Facebook will return user ID, name (first & last) and email
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new InstagramStrategy({
    clientID: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    callbackURL: "https://intense-journey-69692.herokuapp.com/auth/instagram/secrets"
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ instagramId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] }));  //This is where we'll initiate authentication with Google. It will bring up the Google login pop-up

  app.get("/auth/google/secrets",
    passport.authenticate('google', { failureRedirect: "/login" }),  //User will be redirected to 'login' page if authentication fails
    function(req, res) {
      //Redirect user to the 'secrets' page if authentication is successful.
      res.redirect("/secrets");
    });

app.get("/auth/facebook",
  passport.authenticate("facebook", {scope: ["public_profile, email"]}));  //This is where we'll initiate authentication with Facebook. It will bring up the Facebook login pop-up

  app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),  //User wil be redirected to 'login' page if authentication fails
  function(req, res) {
    //Redirect user to 'secrets' page if authentication is successful.
    res.redirect("/secrets");
  });

app.get("/auth/instagram",
  passport.authenticate("instagram", { scope: ["basic"] }));  //This is where we'll initiate authentication with Instagram. It will bring up the Instagram login pop-up

  app.get("/auth/instagram/secrets",
  passport.authenticate("instagram", { failureRedirect: "/login" }),  //User will be redirected to 'login' page if authentication fails
  function(req, res) {
    //Redirect user to 'secrets' page if authentication is successful.
    res.redirect("/secrets");
  });

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/secrets", function(req, res) {  //This is no longer a proviledged page; anyone should be able to view the secrets posted here
  User.find({secret: {$ne: null}}, function(err, foundUsers) {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("secrets", {usersWithSecrets: foundUsers});  //'Secrets' page will be rendered if some users were found (foundUsers) whose 'secret' field is not equal to 'null'
      }
    }
  });
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");  //'Submit' page can only be viewed upon successfull authentication
  } else {
    res.render("/login");  //otherwise... they'll be redirected to the 'login' page
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");  //User will be taken straight to the 'home' page after logging out
});


app.post("/register", function(req, res) {
  User.register({username: req.body.username}, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {  //Callback function triggered only if authentication was successful
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login", function(req, res) {
  const user = new User ({
    username: req.body.username,
    password: req.body.password  //New user is created here
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {  //'Secrets' page can only be viewed if user authentication was successful
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;  //This is the 'secret' that the user submits

  console.log(req.user._id);

  User.findById(req.user._id, function(err, foundUser){
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save(function() {  //We'll save the user's secret here
          res.redirect("/secrets");  //...then redirect them to the 'secrets' page where they can see their own secret + everyone else's!
        });
      }
    }
  });
});

https.createServer({
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.cert")
}, app).listen(process.env.PORT || 3000, function() {
  console.log("Server has started successfully!");
});
