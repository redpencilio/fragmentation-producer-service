import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import {
  BASE_FOLDER,
  CACHE_SIZE,
  FOLDER_DEPTH,
  PAGE_RESOURCES_COUNT,
  SUBFOLDER_NODE_COUNT,
} from './utils/constants';
import Cache from './storage/caching/cache';
import { error, fileForPage } from './utils/utils';
import rdfSerializer from 'rdf-serialize';
import rdfParser from 'rdf-parse';
import { convert, getStreams } from './storage/file-system/reader';
import { convertToJsonLD } from './storage/file-system/reader';
import PromiseQueue from './utils/promise-queue';
import Node from './models/node';
import convertToMember from './converters/member-converter';
import { createFragmenter } from './fragmenters/fragmenter-factory';

const cache: Cache = new Cache(CACHE_SIZE);

const UPDATE_QUEUE = new PromiseQueue<Node | null | void>();

export async function getIndex(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const domainName = req.protocol + '://' + req.header('host') + '/';
  try {
    const streamNames = await getStreams();
    const streams = streamNames.map((streamName) => {
      return `${domainName}${streamName}/1`;
    });
    return res.json({ streams });
  } catch (e) {
    return next(e);
  }
}

export async function getNode(req: Request, res: Response, next: NextFunction) {
  try {
    console.log(req.protocol + '://' + req.header('host'));
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
    const domainName = req.protocol + '://' + req.header('host') + '/';
    if (
      contentType === 'application/json' ||
      contentType === 'application/ld+json'
    ) {
      const contents = await convertToJsonLD(filePath, domainName);
      res.json(contents);
    } else {
      convert(filePath, contentType, domainName).pipe(res);
    }
  } catch (e) {
    console.error(e);
    return next(e);
  }
}

export async function addMember(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.query.resource) {
      throw new Error('Resource uri parameter was not supplied');
    }

    const contentTypes = await rdfParser.getContentTypes();
    if (!contentTypes.includes(req.headers['content-type'] as string)) {
      return next(error(400, 'Content-Type not recognized'));
    }

    const member = await convertToMember(
      req.query.resource as string,
      req.body,
      req.headers['content-type'] as string
    );

    const fragmenter = createFragmenter(
      (req.query.fragmenter as string) || 'time-fragmenter',
      {
        folder: path.join(BASE_FOLDER, req.params.folder),
        maxResourcesPerPage: PAGE_RESOURCES_COUNT,
        maxNodeCountPerSubFolder: SUBFOLDER_NODE_COUNT,
        folderDepth: FOLDER_DEPTH,
        cache,
      }
    );

    const currentDataset = await UPDATE_QUEUE.push(() =>
      fragmenter.addMember(member)
    );

    await UPDATE_QUEUE.push(() => cache.flush());

    if (currentDataset) {
      res
        .status(201)
        .send(`{"message": "ok", "membersInPage": ${currentDataset.count}}`);
    }
  } catch (e) {
    return next(e);
  }
}
