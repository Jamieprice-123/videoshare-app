const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

app.http('GetVideo', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'videos/{id}',
    handler: async (request, context) => {
        try {
            const videoId = request.params.id;

            // Query for the video by id
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

            // Increment view count
            const video = videos[0];
            video.views = (video.views || 0) + 1;
            await container.item(video.id, video.userId).replace(video);

            return {
                status: 200,
                jsonBody: video,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        } catch (error) {
            context.log('Error fetching video:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to fetch video' },
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }
    }
});