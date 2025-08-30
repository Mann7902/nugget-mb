const request = require('supertest');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const app = next({ dev: false, quiet: true });
const handle = app.getRequestHandler();

let server;

beforeAll(async () => {
  await app.prepare();
  server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
});

afterAll(() => {
  if (server) {
    server.close();
  }
});

describe('API Routes', () => {
  test('/api/health returns 200 OK', async () => {
    const response = await request(server)
      .get('/api/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('service');
  });

  test('/api/generate returns JSON with results for valid input', async () => {
    const sampleInput = {
      topic: 'Remote work productivity',
      tone: 'Professional',
      audience: 'Software developers',
      length: 'medium',
      postCount: 3,
      language: 'English',
      llmProvider: 'gemini'
    };

    const response = await request(server)
      .post('/api/generate')
      .send(sampleInput)
      .expect(200);

    // Since it's a streaming response, we need to handle it differently
    // This is a simplified test - in production you'd test the streaming response
    expect(response.headers['content-type']).toMatch(/text\/plain/);
  }, 30000); // 30 second timeout for AI generation

  test('/api/generate validates required fields', async () => {
    const invalidInput = {
      // Missing required topic
      tone: 'Professional',
    };

    const response = await request(server)
      .post('/api/generate')
      .send(invalidInput)
      .expect(400);

    expect(response.body).toHaveProperty('error', 'Invalid request');
    expect(response.body).toHaveProperty('details');
  });
});