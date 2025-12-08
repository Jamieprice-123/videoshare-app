const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = client.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

app.http('GetVideos', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'videos',
    handler: async (request, context) => {
        try {
            const { resources: videos } = await container.items
                .query('SELECT * FROM c ORDER BY c.uploadDate DESC')
                .fetchAll();

            return {
                status: 200,
                jsonBody: videos,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        } catch (error) {
            context.log('Error fetching videos:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to fetch videos' },
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }
    }
});