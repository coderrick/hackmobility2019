### smartcar-node demo
The goal of this demo application is to make it quick and easy to get started with Smartcar.

If you have questions as you get started, check out our [support center](https://support.smartcar.com) and [docs](https://smartcar.com/docs).

Before you run the demo application, you will need:
- An application configured on Smartcar's [developer portal](https://developer.smartcar.com). When configuring your app, please include `http://localhost:8000/callback` as a redirect uri.
- A client id and secret (obtained from your app configuration above).

To run the demo:
```bash
git clone https://github.com/smartcar/demo.git
cd demo/node
npm install

# For security, you must configure http://localhost:8000/callback as a redirect uri in Smartcar's developer portal.
PORT=8000 \
SMARTCAR_CLIENT_ID=[CLIENT_ID] \
SMARTCAR_SECRET=[CLIENT_SECRET] \
SMARTCAR_REDIRECT_URI=http://localhost:8000/callback \
SMARTCAR_MODE=development \
node app.js
# Navigate to http://localhost:8000
```
