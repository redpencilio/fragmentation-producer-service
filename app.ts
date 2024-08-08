// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import cors from 'cors';
import { addData, getNode } from './lib/controller';
import type { Request, Response, NextFunction } from 'express';

const AUTH_USERNAME = process.env.AUTH_USERNAME || 'username';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'password';
const ENABLE_AUTH = process.env.ENABLE_AUTH === 'true' ? true : false;

app.use(cors());
app.use(
  bodyParser.text({
    type: function () {
      return true;
    },
  })
);

const validateUser = (req: Request, res: Response, next: NextFunction) => {
  if (ENABLE_AUTH) {
    if (req.headers.authorization?.startsWith('Basic ')) {
      const b64value = req.headers.authorization.split(' ')[1];
      const [username, password] = Buffer.from(b64value, 'base64')
        .toString()
        .split(':');
      if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
        return next();
      }
    }
    return res.status(401).send('Authentication failed.');
  }
  return next();
};

app.post('/:folder', validateUser, addData);

app.get('/:folder*/:nodeId', getNode);

app.use(errorHandler);
