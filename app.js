if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const passport = require('passport');
const mongoose = require("mongoose");
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override');
const axios = require('axios');


let db;
mongoose.connect('mongodb+srv://lahiru:lahiru1999@cluster0.9futnla.mongodb.net/profileDB').then((dbConnection) =>
{
  db = dbConnection;
  afterwards();
});


function afterwards()
{

  const profileSchema =
  {
    name: String,
    email: String,
    password: String,
    index: String,
    phone: String,
    isAdmin: Boolean,
    isDoctor: Boolean,
    isMod: Boolean,
    messages: Array,
    notifications: Array,
    reports: Array
  };

  const Profile = mongoose.model('Profile', profileSchema);

  const initializePassport = require('./passport-config');

  initializePassport(passport,
    async (email) =>
    {
      try {
        const foundProfile = await Profile.findOne({ email: email });
        return foundProfile;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
    async (id) =>
    {
      try {
        const foundProfile = await Profile.findOne({ _id: id });
        return foundProfile;
      } catch (err) {
        console.log(err);
        throw err;
      }
    }
  );


  app.set('view-engine', 'ejs');
  app.use(express.urlencoded({ extended: false }));
  app.use(flash());
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(methodOverride('_method'));
  app.use(express.static(__dirname + '/public'));

  app.get('/', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    res.render('index.ejs', { profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
  });

  app.get('/login', checkNotAuthenticated, (req, res) =>
  {
    res.render('login.ejs', { profile: { name: "", index: "" }, account: { admin: false, doctor: false, mod: false, loggedIn: false }, notifications: [] });
  });

  app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true
  }));

  app.get('/register', checkAdminAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    res.render('register.ejs', { error: "", profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
  });

  app.get('/contact', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    res.render('contact.ejs', { error: "", profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
  });

  app.post('/register', checkAdminAuthenticated, async (req, res) =>
  {

    let admin;
    let doctor;
    let mod;
    const user = await req.user;
    const newUser = await req.body;
    try {
      if (await newUser.isAdmin === "on") {
        admin = true;

      } else {
        admin = false;
      }

      if (await newUser.isDoctor === 'on') {
        doctor = true;
      } else {
        doctor = false;
      }

      if (await newUser.isMod === 'on') {
        mod = true;
      } else {
        mod = false;
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const newProfile = new Profile({
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
        index: req.body.index,
        phone: req.body.phone,
        isAdmin: admin,
        isDoctor: doctor,
        isMod: mod,
        messages: [],
        notifications: [],
        reports: []
      });
      console.log("New profile \n " + newProfile);

      const similarEmail = await Profile.findOne({ email: user.email });
      const similarIndex = await Profile.findOne({ name: user.index });



      if (similarEmail !== null && similarIndex !== null) {

        console.log("Email already exists");
        res.render('register.ejs', { error: "Email or ID already exists", profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });

        console.log("Profile successfully registered");
      } else if (newUser.password.length < 8 || newUser.name < 4 || newUser.password.length > 50 || newUser.name > 150) {
        res.render('register.ejs', { error: "Name must be between 4 to 150 characters, the password must be between 8 to 50 characters", profile: { name: user.name, index: user.index } , account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });

      } else if (newUser.phone.length > 50) {
        res.render('register.ejs', { error: "Phone number is too long", profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
      } else {

        newProfile.save();
        res.render('register.ejs', { error: "Account registered successfully!", profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
      }



      // res.redirect('/login');
    } catch(err) {
      console.log(err);
      
    }
  });

  app.delete('/logout', (req, res) =>
  {
    req.logOut(() =>
    {
      res.redirect('/login');
    });
  });

  app.get('/settings', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    res.render('index.ejs', { profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
  });

  app.get('/users', checkAuthenticated, async (req, res) =>
  {

    const user = await req.user;

    Profile.find().then(userList =>
    {


      const userIndexList = userList.map(user => user.index);
      const usernameList = userList.map(user => user.name);
      let userPhoneList = userList.map(user => user.phone);
      let userEmailList = userList.map(user => user.email);


      if (user.isAdmin === false && user.isDoctor == false) {
        userPhoneList = null;
        userEmailList = null;
      }


      res.render('users.ejs', { users: { index: userIndexList, name: usernameList, phone: userPhoneList, email: userEmailList }, profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true, loggedIn: true }, notifications: user.notifications, index: user.index });

    });
  });

  app.post('/users', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;

    Profile.find().then(userList =>
    {
      const filteredArray = userList.filter(obj => {
        return obj.name.includes(req.body.search) || obj.id.includes(req.body.search);
      });

      const userIndexList = filteredArray.map(user => user.index);
      const usernameList = filteredArray.map(user => user.name);
      let userPhoneList = filteredArray.map(user => user.phone);
      let userEmailList = filteredArray.map(user => user.email);


      if (user.isAdmin === false && user.isDoctor == false) {
        userPhoneList = null;
        userEmailList = null;
      }


      res.render('users.ejs', { users: { index: userIndexList, name: usernameList, phone: userPhoneList, email: userEmailList }, profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true, loggedIn: true }, notifications: user.notifications, index: user.index });

    });
  });
  app.get('/users/:userID', checkAuthenticated, async (req, res) =>
  {
    try {
      const user = await req.user;
      const userProfile = await Profile.findOne({ index: req.params.userID });

      if (userProfile) {
        if (user.isAdmin === true || user.isDoctor === true || user.index === userProfile.index) {
          res.render('userprofile.ejs', {
            profile: { name: user.name, index: user.index },
            userProfile: {
              index: userProfile.index,
              name: userProfile.name,
              phone: userProfile.phone,
              email: userProfile.email
            },
            account: {
              admin: user.isAdmin,
              doctor: user.isDoctor,
              mod: user.isMod,
              loggedIn: true
            },
            notifications: user.notifications,
            index: user.index
          });
        } else {
          res.render('userprofile.ejs', {
            profile: { name: user.name, index: user.index },
            userProfile: {
              index: userProfile.index,
              name: userProfile.name,
              phone: "Hidden",
              email: "Hidden"
            },
            account: {
              admin: user.isAdmin,
              doctor: user.isDoctor,
              mod: user.isMod,
              loggedIn: true
            },
            notifications: user.notifications,
            index: user.index
          });
        }
      } else {
        res.status(404).send('User profile not found.');
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred.');
    }
  });

  app.get('/users/:userID/message', checkAuthenticated, async (req, res) =>
  {
    const userProfile = await Profile.findOne({ index: req.params.userID });
    const user = await req.user;

    await Profile.findOneAndUpdate(
      { index: user.index },
      { $pull: { notifications: { index: req.params.userID } } }
    );

    if (userProfile.index === user.index) {
      res.redirect('/users');
    } else {
      const messagesList = user.messages.filter(message => {
        return (
          message.receiver === userProfile.index || message.sender === userProfile.index
        );
      });
      



      const newMessagesList = messagesList.map(message =>
      {
        const date = new Date(message.date);
        const dateString = date.toLocaleString();

        if (message.sender === userProfile.index) {
          return {
            ...message,
            sender: userProfile.name,
            date: dateString

          };
        } else {
          return {
            ...message,
            sender: user.name,
            date: dateString
          };

        }
      }
     
      );

      console.log("changed =>"+newMessagesList);
      if (user.isAdmin === true || user.isDoctor === true) {
        res.render('message.ejs', { users: { reciver: userProfile.index, sender: user.index, important: true, messages: newMessagesList }, profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
      }
      else {
        res.render('message.ejs', { users: { reciver: userProfile.index, sender: user.index, important: false, messages: newMessagesList }, profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
      }
    }
  });

  app.post(`/message/:sender/:receiver`, checkAuthenticated, async (req, res) =>
  {
    try {
      console.log(req.params.sender + "<sender reciver>" + req.params.receiver);
      let messageString = await req.body.message;

      if (req.body.message.length > 5000) {
        messageString = messageString.substring(0, 5000) + "...";
      }

      const sender = await Profile.findOne({ index: req.params.sender });
      const receiver = await Profile.findOne({ index: req.params.receiver });

      await Profile.findOneAndUpdate(
        { index: req.params.sender },
        {
          $push: {
            messages: {
              message: messageString,
              sender: req.params.sender,
              receiver: req.params.receiver,
              date: Date.now()
            }
          }
        }
      );

      const existingNotification = receiver.notifications.find(
        notification => notification.index === req.params.sender
      );

      if (!existingNotification) {
        await Profile.findOneAndUpdate(
          { index: req.params.receiver },
          {
            $push: {
              notifications: { index: req.params.sender, name: sender.name }
            }
          }
        );
      }

      await Profile.findOneAndUpdate(
        { index: req.params.receiver },
        {
          $push: {
            messages: {
              message: req.body.message,
              sender: req.params.sender,
              receiver: req.params.receiver,
              date: Date.now()
            }
          }
        }
      );

      res.redirect(`/users/${receiver.index}/message`);


    } catch (err) {
      console.log(err);

      res.redirect(`/users/${receiver.index}/message`);

    }
  });


  app.get('/notifications', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    res.render('notifications.ejs', { profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, profile: { name: user.name, index: user.index }, notifications: user.notifications });
  });
  app.get('/report/:patient', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    const userProfile = await Profile.findOne({ index: req.params.patient });
    res.render('report.ejs', { profile: { name: user.name, index: user.index }, report: { patient: { index: req.params.patient, name: userProfile.name }, profile: { name: user.name, index: user.index }, doctor: { index: user.index, profile: { name: user.name, index: user.index } } }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
  });
  app.post('/report/:patient', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    if (user.isDoctor === true || user.isAdmin) {
      await Profile.findOneAndUpdate(
        { index: req.params.patient },
        { $push: { reports: { index: req.params.patient + Date.now(), title: req.body.title, by: user.index, description: req.body.description, date: Date.now(), history: req.body.history, allergies: req.body.allergies, treatment: req.body.treatment, recommendations: req.body.recommendations } } }
      );
    }

    res.redirect('/users');
  });
  app.get('/reports/:userID', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    const userProfile = await Profile.findOne({ index: req.params.userID });

    if (user.isDoctor === true || user.isAdmin === true) {

      res.render('reports.ejs', { reports: userProfile.reports, profile: { name: user.name, index: user.index }, account: { admin: user.isAdmin, doctor: user.isDoctor, mod: user.isMod, loggedIn: true }, notifications: user.notifications });
    }


  });

  app.post('/notify', checkAuthenticated, async (req, res) =>
  {
    const user = await req.user;
    console.log(req.user);
    const messageString = await req.body.message;


    const modList = await Profile.find({ isMod: true });

    for (const mod of modList) {
      const receiver = mod.index;

      try {
        console.log(user.index + "<sender reciver>" + mod.index);


        if (req.body.message.length > 5000) {
          messageString = messageString.substring(0, 5000) + "...";
        }

        const sender = await Profile.findOne({ index: user.index });
        const receiver = await Profile.findOne({ index: mod.index });

        await Profile.findOneAndUpdate(
          { index: user.index },
          {
            $push: {
              messages: {
                message: messageString,
                sender: user.index,
                receiver: mod.index,
                date: Date.now()
              }
            }
          }
        );

        const existingNotification = receiver.notifications.find(
          notification => notification.index === user.index
        );

        if (!existingNotification) {
          await Profile.findOneAndUpdate(
            { index: mod.index },
            {
              $push: {
                notifications: { index: user.index, name: sender.name }
              }
            }
          );
        }

        await Profile.findOneAndUpdate(
          { index: mod.index },
          {
            $push: {
              messages: {
                message: req.body.message,
                sender: user.index,
                receiver: mod.index,
                date: Date.now()
              }
            }
          }
        );




      } catch (err) {
        console.log(err);



      }

    }
  });


  async function checkAuthenticated(req, res, next)
  {

    if (req.isAuthenticated()) {

      return next();
    }


    res.redirect('/login');
  }

  async function checkAdminAuthenticated(req, res, next)
  {
    const user = await req.user;
    
    if (req.isAuthenticated() && user.isAdmin === true) {
      console.log("Administrator Logged In");
      return next();
    }

    res.redirect('/login');
  }

  function checkNotAuthenticated(req, res, next)
  {
    if (req.isAuthenticated()) {
      return res.redirect('/');
    }
    next();
  }


  app.listen(3000);
}

