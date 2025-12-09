const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const crypto = require('crypto');

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database(process.env.COSMOS_DATABASE);
const container = database.container(process.env.COSMOS_CONTAINER);

// Simple hash function for passwords
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

app.http('AuthRegister', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'auth/register',
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
            const { username, email, password } = await request.json();

            // Validate input
            if (!username || !email || !password) {
                return {
                    status: 400,
                    jsonBody: { error: 'Username, email and password are required' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            if (password.length < 6) {
                return {
                    status: 400,
                    jsonBody: { error: 'Password must be at least 6 characters' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // Check if user already exists
            const { resources: existingUsers } = await container.items
                .query({
                    query: 'SELECT * FROM c WHERE c.type = "user" AND (c.email = @email OR c.username = @username)',
                    parameters: [
                        { name: '@email', value: email.toLowerCase() },
                        { name: '@username', value: username.toLowerCase() }
                    ]
                })
                .fetchAll();

            if (existingUsers.length > 0) {
                return {
                    status: 409,
                    jsonBody: { error: 'Username or email already exists' },
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }

            // Create user
            const userId = `user-${Date.now()}`;
            const user = {
                id: userId,
                odataType: 'user',
                type: 'user',
                username: username,
                displayName: username,
                email: email.toLowerCase(),
                passwordHash: hashPassword(password),
                createdAt: new Date().toISOString(),
                userId: userId // Partition key
            };

            await container.items.create(user);

            // Return user without password
            const { passwordHash, ...safeUser } = user;

            return {
                status: 201,
                jsonBody: { 
                    message: 'Registration successful',
                    user: safeUser
                },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        } catch (error) {
            context.log('Error registering user:', error);
            return {
                status: 500,
                jsonBody: { error: 'Failed to register user', details: error.message },
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }
    }
});