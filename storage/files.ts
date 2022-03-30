import fs from "fs";
import { Quad, Store } from "n3";
import rdfParser from "rdf-parse";
import rdfSerializer from "rdf-serialize";
import jsstream from "stream";
import type { Stream } from "@rdfjs/types";

/**
 * Contains abstractions for working with files containing turtle
 * content.
 */

interface FileCache {
  [file: string]: string;
}

const fileCache: FileCache = {};

/**
 * Loads a file as a string.
 *
 * @param {string} file The file path as a string.
 * @return {string} Contents of the file, read as UTF-8.
 */
export function triplesFileAsString(file: string): string {
  if (!fileCache[file]) fileCache[file] = fs.readFileSync(file, "utf8");

  return fileCache[file];
}

/**
 * Reads the triples in a file, assuming text/turtle.
 *
 * @param {string} file File path where the turtle file is stored.
 * @return {Stream} Stream containing all triples which were downloaded.
 */

export function readTriplesStream(file: string): Stream<Quad> {
  const fileStream = jsstream.Readable.from(triplesFileAsString(file));
  return rdfParser.parse(fileStream, {
    contentType: "text/turtle",
    baseIRI: "/",
  });
}

export function createStore(quadStream: Stream<Quad>): Promise<Store> {
  const store = new Store();
  return new Promise((resolve, reject) =>
    store
      .import(quadStream)
      .on("error", reject)
      .once("end", () => resolve(store))
  );
}
/**
 * Writes the triples in text-turtle to a file.
 *
 * @param {Store} store The store from which content will be written.
 * @param {NamedNode} graph The graph which will be written to the file.
 * @param {string} file Path of the file to which we will write the content.
 */
export function writeTriplesStream(store: Store, file: string): Promise<void> {
  const quadStream = jsstream.Readable.from(store);
  const turtleStream = rdfSerializer.serialize(quadStream, {
    contentType: "text/turtle",
  });
  const writeStream = fs.createWriteStream(file);
  let fileData = "";
  turtleStream.on("data", (turtleChunk) => {
    writeStream.write(turtleChunk);
    fileData += turtleChunk;
  });
  return new Promise((resolve, reject) => {
    turtleStream.on("error", reject);
    turtleStream.on("end", () => {
      writeStream.end();
      fileCache[file] = fileData;
      resolve();
    });
  });
}

interface PageCache {
  [folder: string]: number;
}

const lastPageCache: PageCache = {};

/**
 * Clears the last page cache for the supplied folder.
 *
 * @param {string} folder The folder for which the last page cache will be cleared.
 */
export function clearLastPageCache(folder: string): void {
  delete lastPageCache[folder];
}

/**
 * Returns the last page number currently available.
 *
 * @param {string} folder The folder in which the files are stored.
 *
 * @return {number | NaN} Biggest page index currently available or NaN
 * if no numbered pages were found.
 */
export function lastPage(folder: string): number {
  if (!lastPageCache[folder]) {
    const files = fs.readdirSync(folder);
    const fileNumbers = files
      .map((path) => {
        const match = path.match(/\d*/);
        if (match) {
          const parsedNumber = match.length && parseInt(match[0]);
          if (parsedNumber && parsedNumber !== NaN) return parsedNumber;
          else return NaN;
        } else {
          return NaN;
        }
      })
      .filter((x) => x !== NaN);

    fileNumbers.sort((a, b) => b - a);
    if (fileNumbers.length) {
      lastPageCache[folder] = fileNumbers[0];
    } else {
      return NaN; // let's not cache this as it's a starting point
    }
  }

  return lastPageCache[folder];
}
