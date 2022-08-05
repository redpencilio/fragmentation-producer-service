const { app, errorHandler } = require('mu-javascript-library');
import bodyParser from 'body-parser';
import cors from 'cors';
import { addMember, getNode } from './lib/controller';

app.use(cors());
app.use(
  bodyParser.text({
    type: function () {
      return true;
    },
  })
);

app.post('/:folder', addMember);

app.get('/:folder*/:nodeId', getNode);

app.use(errorHandler);
