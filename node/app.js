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
// This server will only work for one user account at a time. For a production
// application, please store access tokens in a persistent data store.
let ACCESS_TOKEN = null;

let VEHICLES = {};

// Initialize Smartcar client
const client = new smartcar.AuthClient({
  clientId: SMARTCAR_CLIENT_ID,
  clientSecret: SMARTCAR_SECRET,
  redirectUri: SMARTCAR_REDIRECT_URI,
  development: SMARTCAR_MODE === 'development',
});

/**
 * Configure express server with handlebars as the view engine.
 */
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

/**
 * Render home page with a "Connect your car" button.
 */
app.get('/', function(req, res, next) {

  res.render('home', {
    authUrl: client.getAuthUrl(),
  });

});

/**
 * Helper function that redirects to the /error route with a specified
 * error message and action.
 */
const redirectToError = (res, message, action) => res.redirect(url.format({
  pathname: '/error',
  query: {message, action},
}));

/**
 * Render error page. Displays the action that was attempted and the error
 * message associated with that action (extracted from query params).
 */
app.get('/error', function(req, res, next) {

  const {action, message} = req.query;
  if (!action && !message) {
    return res.redirect('/');
  }

  res.render('error', {action, message});

});

/**
 * Called on return from the Smartcar authorization flow. This route extracts
 * the authorization code from the url and exchanges the code with Smartcar
 * for an access token that can be used to make requests to the vehicle.
 */
app.get('/callback', function(req, res, next) {

  const code = _.get(req, 'query.code');
  if (!code) {
    return res.redirect('/');
  }

  // Exchange authorization code for access token
  client.exchangeCode(code)
    .then(function(access) {
      ACCESS_TOKEN = _.get(access, 'accessToken');
      return res.redirect('/vehicles');
    })
    .catch(function(err) {
      const message = err.message || `Failed to exchange authorization code for access token`;
      const action = 'exchanging authorization code for access token';
      return redirectToError(res, message, action);
    });

});

/**
 * Renders a list of vehicles. Lets the user select a vehicle and type of
 * request, then sends a POST request to the /request route.
 */
app.get('/vehicles', function(req, res, next) {

  if (!ACCESS_TOKEN) {
    return res.redirect('/');
  }

  smartcar.getVehicleIds(ACCESS_TOKEN)
    .then(function({vehicles: vehicleIds}) {
      const vehiclePromises = vehicleIds.map(vehicleId => {
        const vehicle = new smartcar.Vehicle(vehicleId, ACCESS_TOKEN);
        VEHICLES[vehicleId] = {
          id: vehicleId,
          instance: vehicle,
        };
        return vehicle.info();
      });

      return Promise.all(vehiclePromises)
        .then(function(vehicles) {

          // Add vehicle info to vehicle objects
          _.forEach(vehicles, vehicle => {
            const {id: vehicleId} = vehicle;
            VEHICLES[vehicleId] = Object.assign(VEHICLES[vehicleId], vehicle);
          });

          res.render('vehicles', {vehicles});
        })
        .catch(function(err) {
          const message = err.message || 'Failed to get vehicle info.';
          const action = 'fetching vehicle info';
          return redirectToError(res, message, action);
        });
    });

});

/**
 * Triggers a request to the vehicle and renders the response.
 */
app.post('/request', function(req, res, next) {

  const {vehicleId, requestType: type} = req.body;
  const vehicle = _.get(VEHICLES, vehicleId);
  const {instance} = vehicle;

  let data = null;

  switch(type) {
    case 'info':
      instance.info()
        .then(data => res.render('data', {data, type, vehicle}))
        .catch(function(err) {
          const message = err.message || 'Failed to get vehicle info.';
          const action = 'fetching vehicle info';
          return redirectToError(res, message, action);
        });
      break;
    case 'location':
      instance.location()
        .then(({data}) => res.render('data', {data, type, vehicle}))
        .catch(function(err) {
          const message = err.message || 'Failed to get vehicle location.';
          const action = 'fetching vehicle location';
          return redirectToError(res, message, action);
        });
      break;
    case 'odometer':
      instance.odometer()
        .then(({data}) => res.render('data', {data, type, vehicle}))
        .catch(function(err) {
          const message = err.message || 'Failed to get vehicle odometer.';
          const action = 'fetching vehicle odometer';
          return redirectToError(res, message, action);
        });
      break;
    case 'lock':
      instance.lock()
        .then(function() {
          res.render('data', {
            // Lock and unlock requests do not return data if successful
            data: {
              action: 'Lock request sent.',
            },
            type,
            vehicle,
          });
        })
        .catch(function(err) {
          const message = err.message || 'Failed to send lock request to vehicle.';
          const action = 'locking vehicle';
          return redirectToError(res, message, action);
        });
      break;
    case 'unlock':
      instance.unlock()
        .then(function() {
          res.render('data', {
            vehicle,
            type,
            // Lock and unlock requests do not return data if successful
            data: {
              action: 'Unlock request sent.',
            },
          });
        })
        .catch(function(err) {
          const message = err.message || 'Failed to send unlock request to vehicle.';
          const action = 'unlocking vehicle';
          return redirectToError(res, message, action);
        });
      break;
    default:
      return redirectToError(
        res,
        `Failed to find request type ${requestType}`,
        'sending request to vehicle'
      );
  }

});

app.listen(PORT, function() {
  console.log(`smartcar-demo server listening on port ${PORT}`);
});
