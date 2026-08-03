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

  it('PUT /api/posts/:id — edit post caption, mood, hashtags', async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    // Create a post
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        caption: 'Original caption',
        category: 'General'
      });
    expect(postRes.statusCode).toBe(201);
    const postId = postRes.body._id;

    // Edit the post
    const editRes = await request(app)
      .put(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ caption: 'Updated caption!', mood: 'Happy', hashtags: ['#updated', '#spotlite'] });
    expect(editRes.statusCode).toBe(200);
    expect(editRes.body.caption).toBe('Updated caption!');
    expect(editRes.body.mood).toBe('Happy');
    expect(editRes.body.hashtags).toContain('#updated');
  });

  it('GET /api/posts/search?q= — search posts by caption', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    const searchRes = await request(app)
      .get('/api/posts/search?q=spotlite')
      .set('Authorization', `Bearer ${token}`);
    expect(searchRes.statusCode).toBe(200);
    expect(Array.isArray(searchRes.body)).toBe(true);
  });

  it('DELETE /api/notifications — clear all notifications', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    const deleteRes = await request(app)
      .delete('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.message).toMatch(/cleared/i);
  });

  it('POST /api/posts/:id/repost — repost a post with a comment', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    // Create original post
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        caption: 'This is the original post',
        category: 'Tech'
      });
    expect(postRes.statusCode).toBe(201);
    const originalId = postRes.body._id;

    // Repost it
    const repostRes = await request(app)
      .post(`/api/posts/${originalId}/repost`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repostComment: 'Great post worth sharing!' });
    expect(repostRes.statusCode).toBe(201);
    expect(repostRes.body.repostOf).toBeDefined();
    expect(repostRes.body.repostComment).toBe('Great post worth sharing!');
  });

  it('POST /api/posts/:id/vote — vote on a poll (exclusive)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    // Create a poll post
    const pollRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        caption: '',
        category: 'General',
        poll: {
          question: 'Best MERN stack tool?',
          options: [{ text: 'MongoDB', votes: [] }, { text: 'Express', votes: [] }]
        }
      });
    expect(pollRes.statusCode).toBe(201);
    const pollPostId = pollRes.body._id;

    // Vote on option 0
    const voteRes = await request(app)
      .post(`/api/posts/${pollPostId}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optionIndex: 0 });
    expect(voteRes.statusCode).toBe(200);
    expect(voteRes.body.poll.options[0].votes).toBe(1);
    expect(voteRes.body.poll.options[0].votedByMe).toBe(true);

    // Change vote to option 1 (exclusive — old vote should be removed)
    const voteRes2 = await request(app)
      .post(`/api/posts/${pollPostId}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ optionIndex: 1 });
    expect(voteRes2.statusCode).toBe(200);
    expect(voteRes2.body.poll.options[0].votes).toBe(0);
    expect(voteRes2.body.poll.options[1].votes).toBe(1);
    expect(voteRes2.body.poll.options[1].votedByMe).toBe(true);
  });

  it('GET /api/auth/dev-code — returns pending verification code from DB', async () => {
    const testEmail = `devcode_${Date.now()}@example.com`;
    const testUsername = `devuser_${Date.now()}`;

    // Register (email send is bypassed in test env via NODE_ENV=test)
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUsername, email: testEmail, password: 'password123' });
    expect(regRes.statusCode).toBe(201);

    // Use dev-code to fetch the code without checking inbox
    const devRes = await request(app)
      .get(`/api/auth/dev-code?email=${testEmail}`);
    expect(devRes.statusCode).toBe(200);
    expect(devRes.body).toHaveProperty('code');
    expect(devRes.body.code).toHaveLength(6);
    expect(devRes.body.email).toBe(testEmail);
    expect(devRes.body.expiresInSeconds).toBeGreaterThan(0);
  });

  it('Full email verification flow: register → dev-code → verify → login', async () => {
    const testEmail = `flow_${Date.now()}@example.com`;
    const testUsername = `flowuser_${Date.now()}`;

    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: testUsername, email: testEmail, password: 'mypassword' });
    expect(regRes.statusCode).toBe(201);
    expect(regRes.body.requiresVerification).toBe(true);

    // 2. Get code via dev-code (simulates getting from email)
    const devRes = await request(app)
      .get(`/api/auth/dev-code?email=${testEmail}`);
    expect(devRes.statusCode).toBe(200);
    const { code } = devRes.body;

    // 3. Verify with the code
    const verifyRes = await request(app)
      .post('/api/auth/verify')
      .send({ email: testEmail, code });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body).toHaveProperty('token');
    expect(verifyRes.body.user.isVerified).toBe(true);

    // 4. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testUsername, password: 'mypassword' });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toHaveProperty('token');

    // 5. dev-code should now return 400 (already verified)
    const devRes2 = await request(app)
      .get(`/api/auth/dev-code?email=${testEmail}`);
    expect(devRes2.statusCode).toBe(400);
    expect(devRes2.body.error).toMatch(/already verified/i);
  });

  it('GET /api/posts/user/:username — fetches user posts for profile grid', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/posts/user/admin')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/users/profile — updates user profile bio, website, github, and profileTheme', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    const profileRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bio: 'Updated Spotlite Bio for Deep Testing ✨',
        bioLink: 'https://spotlite.dev',
        githubUrl: 'https://github.com/spotlite',
        profileTheme: 'purple',
        spotlightMode: 'neon'
      });

    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body.bio).toBe('Updated Spotlite Bio for Deep Testing ✨');
    expect(profileRes.body.accentColor).toBe('purple');
  });

  it('POST /api/users/change-password — changes user password and verifies re-authentication', async () => {
    const testEmail = `pwd_change_${Date.now()}@example.com`;
    const testUsername = `pwd_user_${Date.now()}`;

    // Register & Verify
    await request(app)
      .post('/api/auth/register')
      .send({ username: testUsername, email: testEmail, password: 'oldPassword123' });
    const devRes = await request(app).get(`/api/auth/dev-code?email=${testEmail}`);
    await request(app).post('/api/auth/verify').send({ email: testEmail, code: devRes.body.code });

    // Login with old password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testUsername, password: 'oldPassword123' });
    const token = loginRes.body.token;

    // Change Password
    const changeRes = await request(app)
      .post('/api/users/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldPassword123', newPassword: 'newPassword456' });

    expect(changeRes.statusCode).toBe(200);
    expect(changeRes.body.message).toMatch(/success/i);

    // Login with new password
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testUsername, password: 'newPassword456' });
    expect(newLoginRes.statusCode).toBe(200);
    expect(newLoginRes.body.token).toBeDefined();
  });

  it('POST /api/messages & GET /api/messages/conversations — sends message and returns conversation inbox', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;
    const adminUser = loginRes.body.user;

    const msgRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ receiverId: adminUser._id || adminUser.id, text: 'Self message test 💬' });

    expect(msgRes.statusCode).toBe(201);
    expect(msgRes.body.text).toBe('Self message test 💬');

    const convRes = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(convRes.statusCode).toBe(200);
    expect(Array.isArray(convRes.body)).toBe(true);
  });

  it('GET /api/admin/users & Admin verification toggle — returns user directory for admin', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'prudhvi' });
    const token = loginRes.body.token;

    const usersRes = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(usersRes.statusCode).toBe(200);
    expect(usersRes.body.users.length).toBeGreaterThan(0);
  });

  it('GET /api/users/search?q= — search users with special regex characters safely', async () => {
    const res = await request(app).get('/api/users/search?q=admin(test)');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});



