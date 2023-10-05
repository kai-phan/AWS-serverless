import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export async function upload() {}

export async function presignImage({ body }: any) {
  const s3Client = new S3Client({});

  const key = uuidv4();
  const { extension, name } = JSON.parse(body);


  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: `images/${name}${key}.${extension}`,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return Promise.resolve({
    statusCode: 200,
    body: JSON.stringify({ signedUrl }),
  });
}