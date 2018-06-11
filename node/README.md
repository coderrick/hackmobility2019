### smartcar-node demo

```bash
git clone https://github.com/smartcar/demo.git
cd demo/node
npm install

# For security, you must configure http://localhost:8000/callback as a redirect
# uri in Smartcar's developer portal.
PORT=8000 \
SMARTCAR_CLIENT_ID=[CLIENT_ID] \
SMARTCAR_SECRET=[CLIENT_SECRET] \
SMARTCAR_REDIRECT_URI=http://localhost:8000/callback \
SMARTCAR_MODE=development \
node app.js
# Navigate to http://localhost:8000
```
