'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
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

let ACCESS_TOKEN = null;
let VEHICLES = null;
let RESPONSE = null;

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
  response.render('home', {
    authUrl: client.getAuthUrl(),
    accessToken: ACCESS_TOKEN,
  });
});

app.get('/callback', function(request, response, next) {
  const code = _.get(request, 'query.code');

  // exchange code for access token
  client.exchangeCode(code)
    .then(function(access) {
      ACCESS_TOKEN = _.get(access, 'accessToken');
      response.redirect('/vehicles');
    })
    .catch(function(err) {
      console.log('there has been an error!!!!');
      console.log(err);
      response.redirect('/');
    });
});

app.get('/vehicles', function(request, response, next) {

  if (!ACCESS_TOKEN) {
    response.redirect('/');
  }

  smartcar.getVehicleIds(ACCESS_TOKEN)
    .then(function(res) {
      const vehicleIds = _.get(res, 'vehicles');

      const vehicles = {};
      _.forEach(vehicleIds, vehicleId => {
        vehicles[vehicleId] = {
          id: vehicleId,
          instance: new smartcar.Vehicle(vehicleId, ACCESS_TOKEN),
        };
      });

      // Add vehicle info to vehicle objects
      const vehicleInfoPromises = _.map(vehicles, ({instance}) => instance.info());
      return Promise.all(vehicleInfoPromises)
        .then(function(vehicleInfos) {

          _.forEach(vehicleInfos, vehicleInfo => {
            const {id} = vehicleInfo;
            vehicles[id] = Object.assign(vehicles[id], vehicleInfo);
          });

          VEHICLES = vehicles;
          response.render('vehicles', {vehicles, response: RESPONSE});
        })
        .catch(function(err) {
          console.log(err);
          response.redirect('/');
        });
    });

});

app.post('/request', function(request, response, next) {
  const {vehicleId, requestType} = request.body;
  const vehicle = VEHICLES[vehicleId];
  const {instance} = vehicle;

  let data = null;

  switch(requestType) {
    case 'info':
      instance.info()
        .then(function(res) {
          response.render('data', {
            vehicle,
            data: res,
            type: requestType,
          });
        });
      break;
    case 'location':
      instance.location()
        .then(function(res) {
          const {data} = res;
          response.render('data', {
            vehicle,
            data,
            type: requestType,
          });
        });
    case 'odometer':
      instance.odometer()
        .then(function(res) {
          const {data} = res;
          response.render('data', {
            vehicle,
            data,
            type: requestType,
          });
        });
    case 'lock':
      instance.lock()
        .then(function() {
          response.render('data', {
            vehicle,
            data: {
              action: 'Lock request sent.',
            },
            type: requestType,
          });
        });
    case 'unlock':
      instance.unlock()
        .then(function() {
          response.render('unlock', {
            vehicle,
            data: {
              action: 'Unlock request sent.',
            },
            type: requestType,
          });
        });
    default:
  }

});

app.listen(PORT, function() {
  console.log(`smartcar-demo server listening on port ${PORT}`);
});
