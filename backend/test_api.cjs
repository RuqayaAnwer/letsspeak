const http = require('http');

const loginData = JSON.stringify({ email: 'admin@example.com', password: 'password' });

const loginReq = http.request({
  hostname: 'localhost',
  port: 8000,
  path: '/api/auth/dev-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).token;
    
    const postData = JSON.stringify({ note: 'test note', type: 'strength' });
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: '/api/students/1/notes',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Length': postData.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
      });
    });
    req.write(postData);
    req.end();
  });
});
loginReq.write(loginData);
loginReq.end();
