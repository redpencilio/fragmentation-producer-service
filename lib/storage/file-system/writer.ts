import fs from 'fs';
import Node from '../../models/node';
import path from 'path';

const ttl_write = require('@graphy/content.ttl.write');
import { convertToStream } from '../../converters/node-converters';

async function createParentFolderIfNecessary(file: string) {
  if (!fs.existsSync(path.dirname(file))) {
    await new Promise<void>((resolve, reject) => {
      fs.mkdir(path.dirname(file), { recursive: true }, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
}

export async function writeNode(node: Node, path: string) {
  const quadStream = convertToStream(node);

  await createParentFolderIfNecessary(path);
  const turtleStream = quadStream.pipe(ttl_write());
  const writeStream = fs.createWriteStream(path);

  turtleStream.on('data', (turtleChunk: any) => {
    writeStream.write(turtleChunk);
  });

  return new Promise<void>((resolve, reject) => {
    turtleStream.on('error', () => {
      reject('Something went wrong while writing node to file');
    });
    turtleStream.on('end', () => {
      writeStream.end(() => {
        resolve();
      });
    });
  });
}
