import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import {
  BASE_FOLDER,
  CACHE_SIZE,
  FOLDER_DEPTH,
  PAGE_RESOURCES_COUNT,
  SUBFOLDER_NODE_COUNT,
} from './utils/constants';
import Cache from './storage/cache';
import { error, fileForPage, Newable } from './utils/utils';
import rdfSerializer from 'rdf-serialize';
import rdfParser from 'rdf-parse';
import { convert, convertToJsonLD } from './storage/files';
import Fragmenter from './fragmenters/Fragmenter';
import TimeFragmenter from './fragmenters/TimeFragmenter';
import PrefixTreeFragmenter from './fragmenters/PrefixTreeFragmenter';
import nodeStream from 'stream';
import Resource from './models/resource';
import PromiseQueue from './utils/promise-queue';
import Node from './models/node';

import { DataFactory } from 'n3';
const { namedNode } = DataFactory;

const cache: Cache = new Cache(CACHE_SIZE);

const FRAGMENTERS = new Map<string, Newable<Fragmenter>>();

FRAGMENTERS.set('time-fragmenter', TimeFragmenter);

FRAGMENTERS.set('prefix-tree-fragmenter', PrefixTreeFragmenter);

const UPDATE_QUEUE = new PromiseQueue<Node | null | void>();

export async function getNode(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.params.nodeId);
    const pagesFolder = path.join(BASE_FOLDER, req.params.folder);

    if (page > cache.getLastPage(pagesFolder)) {
      return next(error(404, 'Page not found'));
    }

    if (page < cache.getLastPage(pagesFolder))
      res.header('Cache-Control', 'public, immutable');

    const contentTypes = await rdfSerializer.getContentTypes();

    const contentType = req.accepts(contentTypes);
    if (!contentType) {
      return next(error(406));
    }
    const filePath = fileForPage(
      path.join(pagesFolder, req.params[0] || ''),
      page
    );
    res.header('Content-Type', contentType);
    if (
      contentType === 'application/json' ||
      contentType === 'application/ld+json'
    ) {
      const contents = await convertToJsonLD(filePath);
      res.json(contents);
    } else {
      convert(filePath, contentType).pipe(res);
    }
  } catch (e) {
    console.error(e);
    return next(e);
  }
}

export async function addResource(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.query.resource) {
      throw new Error('Resource uri parameter was not supplied');
    }
    if (
      req.query.fragmenter &&
      !FRAGMENTERS.has(req.query.fragmenter as string)
    ) {
      throw new Error('Supplied fragmenter type does not exist');
    }

    const fragmenterClass =
      FRAGMENTERS.get(req.query.fragmenter as string) || TimeFragmenter;

    const fragmenter = new fragmenterClass({
      folder: path.join(BASE_FOLDER, req.params.folder),
      maxResourcesPerPage: PAGE_RESOURCES_COUNT,
      maxNodeCountPerSubFolder: SUBFOLDER_NODE_COUNT,
      folderDepth: FOLDER_DEPTH,
      cache,
    });
    const contentTypes = await rdfParser.getContentTypes();
    if (!contentTypes.includes(req.headers['content-type'] as string)) {
      return next(error(400, 'Content-Type not recognized'));
    }

    const quadStream = rdfParser.parse(nodeStream.Readable.from(req.body), {
      contentType: req.headers['content-type'] as string,
    });
    const resource = new Resource(namedNode(req.query.resource as string));
    for await (const quadObj of quadStream) {
      resource.addProperty(quadObj.predicate.value, quadObj.object);
    }

    const currentDataset = await UPDATE_QUEUE.push(() =>
      fragmenter.addResource(resource)
    );

    await UPDATE_QUEUE.push(() => cache.flush());

    if (currentDataset) {
      res
        .status(201)
        .send(`{"message": "ok", "triplesInPage": ${currentDataset.count()}}`);
    }
  } catch (e) {
    console.error(e);
    return next(e);
  }
}
