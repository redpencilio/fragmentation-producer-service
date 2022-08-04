import rdfParser from 'rdf-parse';
import nodeStream from 'stream';
import { DataFactory } from 'n3';
import MemberNew from '../models/member-new';
const { namedNode } = DataFactory;

export default async function convertToMember(
  resource: string,
  body: any,
  contentType: string
): Promise<MemberNew> {
  const quadStream = rdfParser.parse(nodeStream.Readable.from(body), {
    contentType,
  });
  const member = new MemberNew(namedNode(resource));
  await member.importStream(quadStream);
  return member;
}
