import rdfParser from 'rdf-parse';
import nodeStream from 'stream';
import { DataFactory } from 'n3';
import Member from '../models/member';
const { namedNode } = DataFactory;

export default async function convertToMember(
  resource: string,
  body: any,
  contentType: string
): Promise<Member> {
  try {
    const quadStream = rdfParser.parse(nodeStream.Readable.from(body), {
      contentType,
    });
    const member = new Member(namedNode(resource));
    await member.importStream(quadStream);
    return member;
  } catch (e) {
    throw new Error(
      `Something went wrong while parsing the request body: ${e}`
    );
  }
}
