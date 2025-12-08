const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');
const { QueueServiceClient } = require('@azure/storage-queue');
const { v4: uuidv4 } = require('uuid');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(process.env.STORAGE_CONTAINER);

const queueServiceClient = QueueServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
const queueClient = queueServiceClient.getQueueClient('video-processing');

app.http('UploadVideo', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'videos',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            };
        }

        try {
            const formData = await request.formData();
            const videoFile = formData.get('video');
            const title = formData.get('title') || 'Untitled';
            const description = formData.get('description') || '';
            const userId = formData.get('userId') || 'anonymous';

            if (!videoFile) {
                return {
                    status: 400,
                    jsonBody: { error: 'No video file provided' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // Generate unique ID and blob name
            const videoId = uuidv4();
            const blobName = `${videoId}-${videoFile.name}`;

            // Upload to Blob Storage
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            const arrayBuffer = await videoFile.arrayBuffer();
            await blockBlobClient.upload(arrayBuffer, arrayBuffer.byteLength, {
                blobHTTPHeaders: { blobContentType: videoFile.type }
            });

            // Create video metadata
            const videoMetadata = {
                id: videoId,
                title: title,
                description: description,
                userId: userId,
                videoUrl: blockBlobClient.url,
                blobName: blobName,
                contentType: videoFile.type,
                size: arrayBuffer.byteLength,
                uploadDate: new Date().toISOString(),
                views: 0,
                likes: 0,
                processingStatus: 'queued'
            };

            // Save to Cosmos DB
            await container.items.create(videoMetadata);

            // Add message to processing queue (Web-Queue-Worker pattern)
            const queueMessage = {
                videoId: videoId,
                title: title,
                userId: userId,
                blobName: blobName,
                timestamp: new Date().toISOString()
            };
            
            // Base64 encode the message for Azure Queue
            const messageText = Buffer.from(JSON.stringify(queueMessage)).toString('base64');
            await queueClient.sendMessage(messageText);
            
            context.log(`Video ${videoId} queued for processing`);

            return {
                status: 201,
                jsonBody: videoMetadata,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        } catch (error) {
            context.log('Error uploading video:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to upload video', details: error.message },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }
    }
});