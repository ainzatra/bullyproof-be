import { PutObjectCommand, S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
 
@Injectable()
export class S3Service {
 
    async upload(file: any, key: string) {
        const region = process.env.AWS_REGION;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const bucket = process.env.S3_BUCKET_NAME;
 
        if (!region || !accessKeyId || !secretAccessKey || !bucket) {
            throw new InternalServerErrorException('S3 configuration is missing on the server');
        }
 
        const s3 = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        });
 
        try {
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype
            }));
            // Public URL format. Adjust if you use a custom domain / CDN.
            return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
        } catch (err) {
            console.log('Error uploading to S3:', err)
            throw new InternalServerErrorException('Failed to upload image to S3');
        }
    }

    /**
     * Delete all objects under the given prefix (folder) in the configured bucket.
     * This lists objects under the prefix and deletes them in batches.
     */
    async deleteFolder(prefix: string) {
        const region = process.env.AWS_REGION;
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        const bucket = process.env.S3_BUCKET_NAME;
 
        if (!region || !accessKeyId || !secretAccessKey || !bucket) {
            throw new InternalServerErrorException('S3 configuration is missing on the server');
        }

        const s3 = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        });

        try {
            const objectsToDelete: { Key: string }[] = [];
            let continuationToken: string | undefined = undefined;

            // List all objects under the prefix (handle pagination)
            do {
                const listResp = await s3.send(new ListObjectsV2Command({
                    Bucket: bucket,
                    Prefix: prefix,
                    ContinuationToken: continuationToken
                }));

                if (listResp.Contents) {
                    for (const item of listResp.Contents) {
                        if (item.Key) {
                            objectsToDelete.push({ Key: item.Key });
                        }
                    }
                }

                continuationToken = listResp.IsTruncated ? listResp.NextContinuationToken : undefined;
            } while (continuationToken);

            if (objectsToDelete.length === 0) {
                return;
            }

            // Delete in batches of up to 1000 (S3 limit per DeleteObjects)
            const chunkSize = 1000;
            for (let i = 0; i < objectsToDelete.length; i += chunkSize) {
                const chunk = objectsToDelete.slice(i, i + chunkSize);
                await s3.send(new DeleteObjectsCommand({
                    Bucket: bucket,
                    Delete: {
                        Objects: chunk,
                        Quiet: true
                    }
                }));
            }
        } catch (err) {
            console.log('Error deleting S3 folder:', err);
            throw new InternalServerErrorException('Failed to delete S3 folder');
        }
    }
}