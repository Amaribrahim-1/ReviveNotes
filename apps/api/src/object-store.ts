import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

let client: S3Client | null = null;

function readR2Env(): { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string } {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 env is missing");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function r2(): S3Client {
  if (client) {
    return client;
  }
  const config = readR2Env();
  // R2 speaks the S3 API. The region value is required by the client and unused by R2.
  client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

export async function putPrivateObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const config = readR2Env();
  await r2().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function openPrivateObject(key: string): Promise<Readable> {
  const config = readR2Env();
  const output = await r2().send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
  if (output.Body instanceof Readable) {
    return output.Body;
  }
  throw new Error("R2 object has no stream");
}
