'use strict';

const bodyParser = require('body-parser');
const envvar = require('envvar');
const exphbs = require('express-handlebars');
const express = require('express');
const smartcar = require('smartcar');

const PORT = envvar.number('PORT', 8000);
const SMARTCAR_CLIENT_ID = envvar.string('SMARTCAR_CLIENT_ID');
const SMARTCAR_SECRET = envvar.string('SMARTCAR_SECRET');
const SMARTCAR_REDIRECT_URI = envvar.string('SMARTCAR_REDIRECT_URI', `http://localhost:${PORT}/callback`);
const SMARTCAR_MODE = envvar.oneOf('SMARTCAR_MODE', ['development', 'production'], 'development');

const ACCESS_TOKEN = null;

// Initialize Smartcar client
const client = new smartcar.AuthClient({
  clientId: SMARTCAR_CLIENT_ID,
  clientSecret: SMARTCAR_SECRET,
  redirectUri: SMARTCAR_REDIRECT_URI,
  development: SMARTCAR_MODE === 'development',
});

const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
  extended: false
}));
app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  extname: '.hbs',
}));
app.set('view engine', '.hbs');

app.get('/', function(request, response, next) {
  response.render('home');
});

app.listen(PORT, function() {
  console.log(`smartcar-demo server listening on port ${PORT}`);
});
