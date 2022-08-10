import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import cors from 'cors';
import { addMember, getNode } from './lib/controller';
import type { Request, Response, NextFunction } from 'express';
import {
  AUTH_PASSWORD,
  AUTH_USERNAME,
  ENABLE_AUTH,
} from './lib/utils/constants';

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

app.post('/:folder', validateUser, addMember);

app.get('/:folder*/:nodeId', getNode);

app.use(errorHandler);
