const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const crypto = require('crypto');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

app.http('AuthLogin', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/login',
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
            const { email, password } = await request.json();

            // Validate input
            if (!email || !password) {
                return {
                    status: 400,
                    jsonBody: { error: 'Email and password are required' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // Find user by email
            const { resources: users } = await container.items
                .query({
                    query: 'SELECT * FROM c WHERE c.type = "user" AND c.email = @email',
                    parameters: [{ name: '@email', value: email.toLowerCase() }]
                })
                .fetchAll();

            if (users.length === 0) {
                return {
                    status: 401,
                    jsonBody: { error: 'Invalid email or password' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            const user = users[0];

            // Check password
            if (user.passwordHash !== hashPassword(password)) {
                return {
                    status: 401,
                    jsonBody: { error: 'Invalid email or password' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // Generate session token
            const token = generateToken();

            // Return user without password
            const { passwordHash, ...safeUser } = user;

            return {
                status: 200,
                jsonBody: { 
                    message: 'Login successful',
                    user: safeUser,
                    token: token
                },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        } catch (error) {
            context.log('Error logging in:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to login', details: error.message },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }
    }
});