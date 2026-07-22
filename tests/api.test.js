const request = require('supertest');
const app = require('../server');

describe('Spotlite Modular API Tests', () => {
  it('GET /api/auth/me without token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/auth/register with missing fields should return 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '', email: '' });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/ai/generate-caption should return AI caption', async () => {
    const res = await request(app)
      .post('/api/ai/generate-caption')
      .send({ mood: 'Coding' });
    expect(res.statusCode).toBe(200);
    expect(res.body.caption).toContain('#coding');
  });

  it('GET /api/admin/users without token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/auth/register and /api/auth/verify-email full verification flow', async () => {
    const testEmail = `test_verify_${Date.now()}@example.com`;
    const testUsername = `user_${Date.now()}`;

    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUsername, email: testEmail, password: 'password123' });

    expect(regRes.statusCode).toBe(201);
    expect(regRes.body).toHaveProperty('verificationCode');
    const code = regRes.body.verificationCode;

    // 2. Verify
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: testEmail, code: code });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.user.isVerified).toBe(true);
  });
});
