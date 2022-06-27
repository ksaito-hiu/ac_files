import express from 'express';
import session from 'express-session';
import path from 'path';

import auth_init from './auth.js';
import files_init from './files.js';

// CORS(Cross-Origin Resource Sharing)対応のミドルウェア。
const allowCrossDomain = function(req,res,next) {
  const origin = req.get('Origin');
  if (origin===undefined) {
	res.header('Access-Control-Allow-Origin','*');
  } else {
	res.header('Access-Control-Allow-Origin',origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header(
	'Access-Control-Allow-Headers',
	'Content-Type, Authorization, access_token'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method==='OPTIONS') {
	res.sendStatus(200);
  } else {
	next();
  }
};

async function ac_files(config) {
  const app = express();
  app.set('view engine','ejs');
  app.set('views',path.join(process.cwd(),'views'));

  // アプリ全体に対して
  // CORS(Cross-Origin Resource Sharing)
  app.use(allowCrossDomain);

  app.use(session({
    secret: config.server.session.secret,
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    secure: true,
    cookie: { maxAge: config.server.session.maxAge }
  }));
  const auth = await auth_init(config);
  app.use('/auth',auth);

  const files = await files_init(config);
  app.use('/files',files);

  app.get('/', (req, res) => {
    res.send('Hello World!');
  });

  app.get('/test/', (req, res) => {
    res.send('Hello World2!');
  });

  return app;
}

export default ac_files;
