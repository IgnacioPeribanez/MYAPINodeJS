// Importamos nanoid
const nanoid = require('nanoid');

// Importamos generate-api-key
const generateApiKey = require('generate-api-key');

// Importamos express
const express = require('express');

// Importamos body-parser
const bodyParser = require('body-parser');

// Importamos session
const session = require('express-session');

// Importamos MySql
const mysql = require('mysql2');

// Importamos url
const url = require('url');

// Importamos passport
const passport = require('passport');

// Importamos passport-google-oauth
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

// Inicializamos express
const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// Creamos la conexion a MySql
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: 'premier'
});

// Definimos el motor de los templates
app.set('view engine', 'ejs');

// Inicializamos la session 
app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'SECRET'
}));

// Elegimos el puerto donde se ejecutara la web
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('App listening on port ' + port));

// Inicializamos la variable del usuario de google
var userProfile;
// Inicializamos la variable del usuario de la base de datos
var userBase;

// Inicializamos passport con la sesion
app.use(passport.initialize());
app.use(passport.session());

// Gestionamos los atributos del usuario
passport.serializeUser(function (user, cb) {
  cb(null, user);
});
passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

// Introducimos los atributos del cliente al que nos conectaremos
const GOOGLE_CLIENT_ID = 'CLIENTID';
const GOOGLE_CLIENT_SECRET = 'SECRETCLIENTID';
// Nos conectamos al cliente
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback"
},
  function (accessToken, refreshToken, profile, done) {
    userProfile = profile;
    return done(null, userProfile);
  }
));

// Gestionamos la funcion GET que se ejecutara al dirigirnos a /auth/google
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

// Gestionamos la funcion GET que se ejecutara al dirigirnos a /auth/google/callback
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/error' }),
  function (req, res) {
    // Si se inicia sesion correctamente iremos a /success
    res.redirect('/success');
  });

// Gestionamos la funcion GET que se ejecutara si no se consigue logear el usuario
app.get('/error', (req, res) => res.send("error logging in"));

// Gestionamos la funcion GET que se ejecutara al entrar en nuestra web 
app.get('/', function (req, res) {
  // Iniciamos el proceso de inicio de sesion
  res.render('pages/index');
});

// Gestionamos la funcion GET que se ejecutara al entrar en /success 
app.get('/success', (req, res) => {
  // Condicion (si ha iniciado sesion)
  if (userProfile != undefined) {
    db.query('SELECT * FROM `usuario` WHERE `id_Usuario` = ?', [userProfile.id], (error, results) => {
      // Condicion (si el usuario no estaba registrado)
      if (results.length === 0) {
        const api_key = generateApiKey.generateApiKey()
        const nivel = 1
        db.query("INSERT INTO usuario (id_Usuario, api_key, nivel) VALUES (?, ?, ?)", [userProfile.id, api_key, nivel], (error, results) => {
          if (error) throw error;
          db.query('SELECT * FROM `usuario` WHERE `id_Usuario` = ?', [userProfile.id], (error, results) => {
             // Se almacena el usuario de la base de datos que ha iniciado sesion
            userBase = results
            res.render('pages/success', { user: userBase });
          })
        })
      } else {
        // Se almacena el usuario de la base de datos que ha iniciado sesion
        userBase = results
        res.render('pages/success', { user: userBase });
      }
      
    })
  } else{
    res.redirect("/")
  }
});

// Gestionamos la funcion GET que se ejecutara al dirigirnos a /docs que devolbera la documentacion
app.get('/doc', (req, res) => {
  res.render('pages/doc');
});

// Gestionamos la funcion POST que se ejecutara al dirigirnos a /getApiKey (Se ejecutara una vez el usuario quiera cambiar su API-KEY)
app.post("/getApiKey", (req, res) => {
  const id_Usuario = userBase[0].id_Usuario;
  const api_KeyUsuario = userBase[0].api_key;
  // Comprobamos el usuario
  db.query('SELECT * FROM `usuario` WHERE `api_key` = ? and `id_Usuario` = ?', [api_KeyUsuario, id_Usuario], (error, results) => {
    if (results.length != 0) {
      const newApi_key = generateApiKey.generateApiKey()
      // Actualizamos la apikey
      db.query("UPDATE usuario set api_key = ? WHERE api_key = ?",
        [newApi_key, api_KeyUsuario], (error, res) => {
          if (error) throw error;
        });
    }
  });
  // Redireccionamos a la pagina principal del usuario
  res.redirect('/success');
});

// Gestionamos la funcion POST que se ejecutara al dirigirnos a /getNivel (Se ejecutara una vez el usuario quiera cambiar su Nivel)
app.post("/getNivel", (req, res) => {
  const id_Usuario = userBase[0].id_Usuario;
  let nivel = userBase[0].nivel;
  let newNivel;
  // Comprobamos el usuario
  db.query('SELECT * FROM `usuario` WHERE `id_Usuario` = ?', [id_Usuario], (error, results) => {
    if (results.length != 0) {
      // Cambiamos el nivel
      if (nivel == 1) {
        newNivel = 2;
      } else {
        newNivel = 1;
      }
      // Actualizamos en la base de datos su nivel
      db.query("UPDATE usuario set nivel = ? WHERE id_Usuario = ?",
        [newNivel, id_Usuario], (error, results) => {
          if (error) throw error;
        });
    }
  });
  // Redireccionamos a la pagina principal del usuario
  res.redirect('/success');
});

// Gestionamos la funcion GET que se ejecutara al entrar en /success/api/v2/players
app.get('/success/api/v2/players', (req, res) => {
  // Consulta de prueba:
  // http://localhost:3000/success/api/v2/players/?position=Defender&age=32&apikey=KIbXow/S1DcGz/D.cV0ChVYO0a2r0t5c
  const position = req.query.position;
  const age = req.query.age;
  const apikey = req.query.apikey;
  let list = new Array();
  // Select base
  let lsSelect = "SELECT m.* FROM `mytable` m, `usuario` u WHERE 1 = 1 ";
  // Dependiendo de que varibles obtenga modificaremos la select
  if (position != undefined) {
    lsSelect += "and m.position = ? ";
    list.push(position)
  }
  if (age != undefined) {
    lsSelect += "and m.age = ? ";
    list.push(age)
  }
  // Si recibe apikey se ejecuta la consulta
  if (apikey != undefined) {
    lsSelect += "and u.api_key = ? ";
    list.push(apikey)
    db.query('SELECT * FROM `usuario` WHERE `api_key` = ? and nivel = 1 or 2', [apikey], (error, results) => {
      if (error) throw error;
      // Si se aceptan los permisos ejecutamos la select
      if (results.length != 0) {
        db.query(lsSelect, list, (error, results) => {
          if (error) throw error;
          // Si la select no obtiene registros devuelve el mensaje de error, si no es asi devuleve el JSON
          if (results.length != 0) {
            res.end(JSON.stringify(results, null, 3));
          } else {
            res.end(JSON.stringify("Error: Introduzca una apikey valida"));
          }
        });
      } else {
        res.end(JSON.stringify("Error: Introduzca una apikey valida"));
      }
    });
  } else {
    res.end(JSON.stringify("Error: Introduzca una apikey valida"));
  }
});

// Gestionamos la funcion GET que se ejecutara al entrar en /success/api/v2/minutes
app.get('/success/api/v2/minutes', (req, res) => {
  // http://localhost:3000/success/api/v2/minutes/?order=desc&played=overall&apikey=KIbXow/S1DcGz/D.cV0ChVYO0a2r0t5c
  const order = req.query.order;
  const played = req.query.played;
  const apikey = req.query.apikey;
  let list = new Array();
  // Select base
  let lsSelect = "SELECT m.full_name, m.minutes_played_" + played + " FROM `mytable` m, `usuario` u WHERE 1 = 1 ";
  list.push(played)
  // Si recibe apikey se ejecuta la consultas
  if (apikey != undefined) {
    lsSelect += "and u.api_key = ? ";
    list.push(apikey)
    // Si recibe order se almacena
    if (order != undefined) {
      lsSelect += "order by minutes_played_" + played + " " + order;
      list.push(order)
    }
    // Se ejecuta la select
    db.query('SELECT * FROM `usuario` WHERE `api_key` = ? and nivel = 2', [apikey], (error, results) => {
      if (error) throw error;
       // Si se aceptan los permisos ejecutamos la select
      if (results.length != 0) {
        db.query(lsSelect, apikey, (error, results) => {
          if (results.length === 0) {
            res.end(JSON.stringify("Error: No hay ningun registro con esos parametros"));
          }
          res.end(JSON.stringify(results, null, 3));
        });
      } else {
        res.end(JSON.stringify("Error: Introduzca una apikey valida"));
      }
    });
  } else {
    res.end(JSON.stringify("Error: Introduzca una apikey valida"));
  }
});

