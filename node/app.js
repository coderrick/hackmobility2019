'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const envvar = require('envvar');
const exphbs = require('express-handlebars');
const express = require('express');
const smartcar = require('smartcar');
const url = require('url');

// Set Smartcar configuration
const PORT = envvar.number('PORT', 8000);
const SMARTCAR_CLIENT_ID = envvar.string('SMARTCAR_CLIENT_ID');
const SMARTCAR_SECRET = envvar.string('SMARTCAR_SECRET');

// Redirect uri must be added to the application's allowed redirect uris
// in the Smartcar developer portal
const SMARTCAR_REDIRECT_URI = envvar.string('SMARTCAR_REDIRECT_URI', `http://localhost:${PORT}/callback`);

// Setting MODE to "development" will show Smartcar's mock vehicle
const SMARTCAR_MODE = envvar.oneOf('SMARTCAR_MODE', ['development', 'production'], 'development');

// For the purposes of this demo, we store the access token in memory.
// For a production application, please store the access token in a persistent
// data store.
let ACCESS_TOKEN = null;

let VEHICLES = {};

// Initialize Smartcar client
const client = new smartcar.AuthClient({
  clientId: SMARTCAR_CLIENT_ID,
  clientSecret: SMARTCAR_SECRET,
  redirectUri: SMARTCAR_REDIRECT_URI,
  development: SMARTCAR_MODE === 'development',
});

// Configure express server
const app = express();
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Use handlebars
app.engine('.hbs', exphbs({
  defaultLayout: 'main',
  extname: '.hbs',
}));
app.set('view engine', '.hbs');

// Routes
app.get('/', function(request, response, next) {

  response.render('home', {
    authUrl: client.getAuthUrl(),
  });

});

app.get('/error', function(request, response, next) {

  const {action, message} = request.query;
  if (!action && !message) {
    return response.redirect('/');
  }

  response.render('error', {action, message});

});

app.get('/callback', function(request, response, next) {

  const code = _.get(request, 'query.code');
  if (!code) {
    return response.redirect('/');
  }

  // Exchange authorization code for access token
  client.exchangeCode(code)
    .then(function(access) {
      ACCESS_TOKEN = _.get(access, 'accessToken');
      return response.redirect('/vehicles');
    })
    .catch(function(err) {
      return response.redirect(url.format({
        pathname: '/error',
        query: {
          message:err.message || `Failed to exchange authorization code for access token`,
          action: 'exchanging authorization code for access token',
        },
      }));
    });

});

app.get('/vehicles', function(request, response, next) {

  if (!ACCESS_TOKEN) {
    return response.redirect('/');
  }

  smartcar.getVehicleIds(ACCESS_TOKEN)
    .then(res => {
      const vehicleIds = _.get(res, 'vehicles');
      const vehiclePromises = vehicleIds.map(vehicleId => {
        const vehicle = new smartcar.Vehicle(vehicleId, ACCESS_TOKEN);
        VEHICLES[vehicleId] = {
          id: vehicleId,
          instance: vehicle,
        };
        return vehicle.info();
      });

      return Promise.all(vehiclePromises)
        .then(vehicles => {
          response.render('vehicles', {vehicles});
        })
        .catch(err => {
          return response.redirect(url.format({
            pathname: '/error',
            query: {
              message: err.message || 'Failed to get vehicle info.',
              action: 'fetching vehicle info',
            },
          }));
        });
    });

});

app.post('/request', function(request, response, next) {

  const {vehicleId, requestType: type} = request.body;
  const vehicle = _.get(VEHICLES, vehicleId);
  const {instance} = vehicle;

  let data = null;

  switch(type) {
    case 'info':
      instance.info()
        .then(function(res) {
          response.render('data', {data: res, type, vehicle});
        })
        .catch(function(err) {
          return response.redirect(url.format({
            pathname: '/error',
            query: {
              message: err.message || 'Failed to get vehicle info.',
              action: 'fetching vehicle info',
            },
          }));
        })
      break;
    case 'location':
      instance.location()
        .then(function(res) {
          const {data} = res;
          response.render('data', {data, type, vehicle});
        })
        .catch(function(err) {
          return response.redirect(url.format({
            pathname: '/error',
            query: {
              message: err.message || 'Failed to get vehicle location.',
              action: 'fetching vehicle location',
            },
          }));
        });
      break;
    case 'odometer':
      instance.odometer()
        .then(function(res) {
          const {data} = res;
          response.render('data', {data, type, vehicle});
        })
        .catch(function(err) {
          return response.redirect(url.format({
            pathname: '/error',
            query: {
              message: err.message || 'Failed to get vehicle odometer.',
              action: 'fetching vehicle odometer',
            },
          }));
        });
      break;
    case 'lock':
      instance.lock()
        .then(function() {
          response.render('data', {
            // Lock and unlock requests do not return data if successful
            data: {
              action: 'Lock request sent.',
            },
            type,
            vehicle,
          });
        })
        .catch(function(err) {
          return response.redirect(url.format({
            pathname: '/error',
            query: {
              message: err.message || 'Failed to send lock request to vehicle.',
              action: 'locking vehicle',
            },
          }));
        });
      break;
    case 'unlock':
      instance.unlock()
        .then(function() {
          response.render('data', {
            vehicle,
            type,
            // Lock and unlock requests do not return data if successful
            data: {
              action: 'Unlock request sent.',
            },
          });
        })
        .catch(function(err) {
          return response.redirect(url.format({
            pathname: '/error',
            query: {
              message: err.message || 'Failed to send unlock request to vehicle.',
              action: 'unlocking vehicle',
            },
          }));
        })
      break;
    default:
      return response.redirect(url.format({
        pathname: '/error',
        query: {
          message: `Failed to find request type ${requestType}`,
          action: 'sending request to vehicle',
        },
      }));
  }

});

app.listen(PORT, function() {
  console.log(`smartcar-demo server listening on port ${PORT}`);
});
