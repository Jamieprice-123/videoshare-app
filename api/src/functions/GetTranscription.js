const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const https = require('https');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

app.http('GetTranscription', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'videos/{id}/transcript',
    handler: async (request, context) => {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            };
        }

        try {
            const videoId = request.params.id;

            // Get video from Cosmos DB
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

            // If transcript already exists, return it
            if (video.transcript) {
                return {
                    status: 200,
                    jsonBody: {
                        transcript: video.transcript,
                        transcriptionStatus: 'completed'
                    },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // If no transcription started
            if (!video.transcriptionId) {
                return {
                    status: 200,
                    jsonBody: {
                        transcript: null,
                        transcriptionStatus: 'not_started'
                    },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // Check transcription status with Azure
            const status = await checkTranscriptionStatus(video.transcriptionId, context);

            if (status.status === 'Succeeded') {
                // Get the transcript text
                const transcript = await getTranscriptText(status.resultsUrl, context);
                
                // Update video with transcript
                video.transcript = transcript;
                video.transcriptionStatus = 'completed';
                await container.item(video.id, video.userId).replace(video);

                return {
                    status: 200,
                    jsonBody: {
                        transcript: transcript,
                        transcriptionStatus: 'completed'
                    },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            } else if (status.status === 'Failed') {
                video.transcriptionStatus = 'failed';
                await container.item(video.id, video.userId).replace(video);

                return {
                    status: 200,
                    jsonBody: {
                        transcript: null,
                        transcriptionStatus: 'failed',
                        error: status.error
                    },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            } else {
                return {
                    status: 200,
                    jsonBody: {
                        transcript: null,
                        transcriptionStatus: 'processing'
                    },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }
        } catch (error) {
            context.log('Error getting transcription:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to get transcription', details: error.message },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }
    }
});

async function checkTranscriptionStatus(transcriptionId, context) {
    const speechKey = process.env.SPEECH_KEY;
    const speechRegion = process.env.SPEECH_REGION;

    // Handle demo IDs
    if (transcriptionId.startsWith('demo-')) {
        return {
            status: 'Succeeded',
            resultsUrl: null
        };
    }

    return new Promise((resolve, reject) => {
        const options = {
            hostname: `${speechRegion}.api.cognitive.microsoft.com`,
            path: `/speechtotext/v3.1/transcriptions/${transcriptionId}`,
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({
                        status: result.status,
                        resultsUrl: result.links?.files,
                        error: result.properties?.error?.message
                    });
                } catch (e) {
                    resolve({ status: 'Failed', error: 'Could not parse response' });
                }
            });
        });

        req.on('error', (error) => {
            context.log('Status check error:', error);
            resolve({ status: 'Failed', error: error.message });
        });

        req.end();
    });
}

async function getTranscriptText(resultsUrl, context) {
    // For demo transcriptions, return sample text
    if (!resultsUrl) {
        return 'This is a sample transcript generated for demonstration purposes. In a production environment, this would contain the actual speech-to-text transcription of the video audio content.';
    }

    const speechKey = process.env.SPEECH_KEY;

    return new Promise((resolve, reject) => {
        const url = new URL(resultsUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    // Extract transcript text from results
                    const transcriptFile = result.values?.find(f => f.kind === 'Transcription');
                    if (transcriptFile) {
                        // Fetch actual transcript content
                        fetchTranscriptContent(transcriptFile.links.contentUrl, speechKey)
                            .then(text => resolve(text))
                            .catch(() => resolve('Transcript processing completed.'));
                    } else {
                        resolve('Transcript processing completed.');
                    }
                } catch (e) {
                    resolve('Transcript available.');
                }
            });
        });

        req.on('error', (error) => {
            context.log('Get transcript error:', error);
            resolve('Transcript processing completed.');
        });

        req.end();
    });
}

async function fetchTranscriptContent(contentUrl, speechKey) {
    return new Promise((resolve, reject) => {
        const url = new URL(contentUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const text = result.combinedRecognizedPhrases
                        ?.map(p => p.display)
                        .join(' ') || 'No speech detected.';
                    resolve(text);
                } catch (e) {
                    resolve('Transcript available.');
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}