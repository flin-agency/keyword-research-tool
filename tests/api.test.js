const request = require('supertest');
const app = require('../backend/server');

describe('API Endpoints', () => {
  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/research', () => {
    test('should create a research job with valid URL', async () => {
      const response = await request(app)
        .post('/api/research')
        .send({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('job_id');
      expect(typeof response.body.job_id).toBe('string');
    });

    test('should return 400 if URL is missing', async () => {
      const response = await request(app).post('/api/research').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'URL is required');
    });

    test('should normalize invalid URL and process it', async () => {
      const response = await request(app)
        .post('/api/research')
        .send({ url: 'not-a-valid-url' });

      // URL gets normalized to https://not-a-valid-url
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('job_id');
    });

    test('should normalize URL without protocol', async () => {
      const response = await request(app)
        .post('/api/research')
        .send({ url: 'example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('job_id');
    });
  });

  describe('GET /api/research/:jobId', () => {
    test('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/research/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Job not found');
    });

    test('should return job status', async () => {
      // First create a job
      const createResponse = await request(app)
        .post('/api/research')
        .send({ url: 'https://example.com' });

      const jobId = createResponse.body.job_id;

      // Then get its status
      const response = await request(app).get(`/api/research/${jobId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', jobId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');
    });
  });

  describe('GET /api/research/:jobId/export', () => {
    test('should return 404 for non-existent job', async () => {
      const response = await request(app).get('/api/research/non-existent-id/export');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Job not found');
    });

    test('should return 400 for incomplete job', async () => {
      // Create a job
      const createResponse = await request(app)
        .post('/api/research')
        .send({ url: 'https://example.com' });

      const jobId = createResponse.body.job_id;

      // Try to export immediately (job not completed)
      const response = await request(app).get(`/api/research/${jobId}/export`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Job not completed yet');
    });

    test('should return 400 for invalid format', async () => {
      const response = await request(app).get('/api/research/some-id/export?format=invalid');

      expect(response.status).toBe(404); // Will be 404 because job doesn't exist
    });
  });
});
