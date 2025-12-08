const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING);
const blobContainerClient = blobServiceClient.getContainerClient(process.env.STORAGE_CONTAINER);

app.http('DeleteVideo', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'videos/{id}',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            };
        }

        try {
            const videoId = request.params.id;

            // Find the video first
            const { resources: videos } = await container.items
                .query({
                    query: 'SELECT * FROM c WHERE c.id = @id',
                    parameters: [{ name: '@id', value: videoId }]
                })
                .fetchAll();

            if (videos.length === 0) {
                return {
                    status: 404,
                    jsonBody: { error: 'Video not found' },
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };
            }

            const video = videos[0];

            // Delete from Blob Storage
            const blockBlobClient = blobContainerClient.getBlockBlobClient(video.blobName);
            await blockBlobClient.deleteIfExists();

            // Delete from Cosmos DB
            await container.item(video.id, video.userId).delete();

            return {
                status: 200,
                jsonBody: { message: 'Video deleted successfully', id: videoId },
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        } catch (error) {
            context.log('Error deleting video:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to delete video', details: error.message },
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }
    }
});