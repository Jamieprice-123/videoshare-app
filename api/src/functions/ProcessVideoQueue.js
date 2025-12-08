const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

app.storageQueue('ProcessVideoQueue', {
    queueName: 'video-processing',
    connection: 'AzureWebJobsStorage',
    handler: async (message, context) => {
        context.log('Processing video from queue:', message);

        try {
            // Parse the queue message
            const videoData = typeof message === 'string' ? JSON.parse(message) : message;
            
            context.log(`Processing video: ${videoData.videoId}`);
            context.log(`Title: ${videoData.title}`);
            context.log(`Uploaded by: ${videoData.userId}`);

            // Get the video from Cosmos DB
            const { resources: videos } = await container.items
                .query({
                    query: 'SELECT * FROM c WHERE c.id = @id',
                    parameters: [{ name: '@id', value: videoData.videoId }]
                })
                .fetchAll();

            if (videos.length > 0) {
                const video = videos[0];
                
                // Update video with processing status
                video.processingStatus = 'completed';
                video.processedAt = new Date().toISOString();
                video.processingDetails = {
                    queueProcessed: true,
                    processedTimestamp: new Date().toISOString(),
                    workerNode: 'azure-functions-worker'
                };

                await container.item(video.id, video.userId).replace(video);
                context.log(`Video ${videoData.videoId} processing completed`);
            } else {
                context.log(`Video ${videoData.videoId} not found in database`);
            }
        } catch (error) {
            context.log('Error processing video:', error.message);
            throw error; // This will cause the message to be retried
        }
    }
});