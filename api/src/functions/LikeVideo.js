const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

app.http('LikeVideo', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'videos/{id}/like',
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
            const videoId = request.params.id;
            const body = await request.json().catch(() => ({}));
            const action = body.action || 'like'; // 'like' or 'unlike'

            // Find video
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
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            const video = videos[0];
            
            // Update likes count
            if (action === 'like') {
                video.likes = (video.likes || 0) + 1;
            } else if (action === 'unlike' && video.likes > 0) {
                video.likes = video.likes - 1;
            }

            // Save to Cosmos DB
            await container.item(video.id, video.userId).replace(video);

            return {
                status: 200,
                jsonBody: { 
                    likes: video.likes,
                    message: action === 'like' ? 'Video liked!' : 'Video unliked'
                },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        } catch (error) {
            context.log('Error liking video:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to like video', details: error.message },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }
    }
});