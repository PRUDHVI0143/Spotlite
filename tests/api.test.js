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
    const User = require('../server/models/User');
    const dbUser = await User.findOne({ email: testEmail });
    expect(dbUser).not.toBeNull();
    const code = dbUser.verificationCode;

    // 2. Verify
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: testEmail, code: code });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.user.isVerified).toBe(true);
  });

  it('Full E2E user lifecycle: login, create post, like, comment, story, and fetch notifications', async () => {
    // 1. Login default admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });

    expect(loginRes.statusCode).toBe(200);
    const token = loginRes.body.token;
    expect(token).toBeDefined();

    // 2. Create Post
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        caption: 'Automated Test Post #spotlite',
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        category: 'Tech'
      });
    expect(postRes.statusCode).toBe(201);
    const postId = postRes.body._id;

    // 3. Like Post
    const likeRes = await request(app)
      .post(`/api/posts/${postId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(likeRes.statusCode).toBe(200);
    expect(likeRes.body.isLiked).toBe(true);

    // 4. Add Comment
    const commentRes = await request(app)
      .post(`/api/posts/${postId}/comment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Great spotlite post!' });
    expect(commentRes.statusCode).toBe(201);

    // 5. Create Story
    const storyRes = await request(app)
      .post('/api/stories')
      .set('Authorization', `Bearer ${token}`)
      .send({ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', caption: 'Test Story' });
    expect(storyRes.statusCode).toBe(201);

    // 6. Fetch Notifications
    const notifRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(notifRes.statusCode).toBe(200);

    // 7. Suggest Hashtags
    const tagRes = await request(app).post('/api/ai/suggest-hashtags');
    expect(tagRes.statusCode).toBe(200);
    expect(tagRes.body.hashtags).toContain('#spotlite');
  });

  it('GET /api/new-route should return 200 OK', async () => {
    const res = await request(app).get('/api/new-route');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('New route');
  });

  it('GET /api/calls/history without token should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/calls/history');
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/users/note without token should return 401 Unauthorized', async () => {
    const res = await request(app).post('/api/users/note').send({ text: 'Hello Spotlite' });
    expect(res.statusCode).toBe(401);
  });
});



