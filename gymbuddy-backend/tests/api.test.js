const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server'); 
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const Message = require('../models/Message');
const Friend = require('../models/Friend');

const { connect, closeDatabase, clearDatabase } = require('./mongoMemoryServer');

// Setup and teardown functions
beforeAll(async () => {
  // Connect to the in-memory database
  await connect();
});

afterAll(async () => {
  // Close the in-memory database
  await closeDatabase();
});

beforeEach(async () => {
  // Clear all collections before each test
  await clearDatabase();
});

// Create a test user
async function createTestUser() {
  const userData = {
    firstname: 'Test',
    lastname: 'User',
    email: 'test@example.com',
    password: 'password123'
  };

  const response = await request(app)
    .post('/api/auth/register')
    .send(userData);

  return response;
}

// Get a valid JWT token for authenticated requests
async function getAuthToken() {
  const loginData = {
    email: 'test@example.com',
    password: 'password123'
  };

  const response = await request(app)
    .post('/api/auth/login')
    .send(loginData);

  return response.body.token;
}

// Test Authentication Routes
describe('Auth API', () => {
  test('Should register a new user', async () => {
    const response = await createTestUser();
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User registered successfully!');
  });

  test('Should login a user and return JWT token', async () => {
    // First create a user
    await createTestUser();

    // Then try to login
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(loginData.email);
  });

  test('Should reject login with invalid credentials', async () => {
    // First create a user
    await createTestUser();

    // Then try to login with wrong password
    const loginData = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    const response = await request(app)
      .post('/api/auth/login')
      .send(loginData);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid credentials');
  });
});

// Test Calendar API
describe('Calendar API', () => {
  let token;
  let userId;

  beforeEach(async () => {
    // Create a user and get token for authenticated requests
    await createTestUser();
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    token = loginResponse.body.token;
    userId = loginResponse.body.user._id;
  });

  test('Should create a new calendar event', async () => {
    const eventData = {
      title: 'Leg Day',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
      userId: userId,
      shared: true
    };

    const response = await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${token}`)
      .send(eventData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('_id');
    expect(response.body.title).toBe(eventData.title);
    expect(response.body.shared).toBe(true);
  });

  test('Should get user calendar events', async () => {
    // First create an event
    const eventData = {
      title: 'Chest Day',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      userId: userId,
      shared: false
    };

    await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${token}`)
      .send(eventData);

    // Then retrieve events
    const response = await request(app)
      .get(`/api/calendar/events/${userId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBeTruthy();
    expect(response.body.length).toBe(1);
    expect(response.body[0].title).toBe(eventData.title);
  });

  test('Should get shared calendar events', async () => {
    // Create a shared event
    const eventData = {
      title: 'Group Workout',
      start: new Date().toISOString(),
      end: new Date(Date.now() + 3600000).toISOString(),
      userId: userId,
      shared: true
    };

    await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${token}`)
      .send(eventData);

    // Retrieve shared events
    const response = await request(app)
      .get('/api/calendar/events/shared')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBeTruthy();
    expect(response.body.length).toBe(1);
    expect(response.body[0].title).toBe(eventData.title);
  });
});

// Test User Preferences
describe('User Preferences API', () => {
  let token;
  let userId;

  beforeEach(async () => {
    // Create a user and get token for authenticated requests
    await createTestUser();
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    token = loginResponse.body.token;
    userId = loginResponse.body.user._id;
  });

  test('Should update user preferences', async () => {
    const preferencesData = {
      preferences: ['Chest', 'Back', 'Legs']
    };

    const response = await request(app)
      .put(`/api/auth/preferences/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(preferencesData);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Preferences updated successfully.');
    expect(response.body.user.preferences).toEqual(expect.arrayContaining(preferencesData.preferences));
  });
});

// Test Matching System
describe('Matching API', () => {
  let token;
  let userId;
  let otherUserId;

  beforeEach(async () => {
    // Create main test user
    await createTestUser();
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    token = loginResponse.body.token;
    userId = loginResponse.body.user._id;

    // Create another user for matching
    const otherUserData = {
      firstname: 'Match',
      lastname: 'User',
      email: 'match@example.com',
      password: 'password123'
    };

    await request(app)
      .post('/api/auth/register')
      .send(otherUserData);

    const otherLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'match@example.com',
        password: 'password123'
      });

    otherUserId = otherLoginResponse.body.user._id;

    // Create matching preferences for both users
    await request(app)
      .put(`/api/auth/preferences/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: ['Chest', 'Back'] });

    const otherToken = otherLoginResponse.body.token;
    await request(app)
      .put(`/api/auth/preferences/${otherUserId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ preferences: ['Chest', 'Legs'] });

    // Create overlapping calendar events
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 3600000);

    // User 1 event
    await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Workout Session',
        start: now.toISOString(),
        end: oneHourLater.toISOString(),
        userId: userId,
        shared: true
      });

    // User 2 event (overlapping time)
    await request(app)
      .post('/api/calendar/events')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        title: 'Gym Time',
        start: now.toISOString(),
        end: oneHourLater.toISOString(),
        userId: otherUserId,
        shared: true
      });
  });

  test('Should find matching gym buddies', async () => {
    const response = await request(app)
      .get('/api/matches')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.matches)).toBeTruthy();
    
    // Should find at least one match (the other user we created)
    expect(response.body.matches.length).toBeGreaterThan(0);
    
    // Check if the first match contains expected properties
    const firstMatch = response.body.matches[0];
    expect(firstMatch).toHaveProperty('user');
    expect(firstMatch).toHaveProperty('compatibilityScore');
    expect(firstMatch).toHaveProperty('overlapHours');
    expect(firstMatch).toHaveProperty('preferenceMatch');
    
    // Verify the match has a shared preference
    expect(firstMatch.sharedPreferences).toContain('Chest');
  });
});

// Test Messaging System
describe('Messaging API', () => {
  let token;
  let userId;
  let otherUserId;

  beforeEach(async () => {
    // Create main test user
    await createTestUser();
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    token = loginResponse.body.token;
    userId = loginResponse.body.user._id;

    // Create another user to message
    const otherUserData = {
      firstname: 'Message',
      lastname: 'Recipient',
      email: 'recipient@example.com',
      password: 'password123'
    };

    await request(app)
      .post('/api/auth/register')
      .send(otherUserData);

    const otherLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'recipient@example.com',
        password: 'password123'
      });

    otherUserId = otherLoginResponse.body.user._id;
  });

  test('Should send a message to another user', async () => {
    const messageData = {
      recipientId: otherUserId,
      content: 'Hey, want to work out together?'
    };

    const response = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send(messageData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('_id');
    expect(response.body.data.content).toBe(messageData.content);
    expect(response.body.data.sender.toString()).toBe(userId);
    expect(response.body.data.recipient.toString()).toBe(otherUserId);
  });

  test('Should get conversation between users', async () => {
    // First send a message
    const messageData = {
      recipientId: otherUserId,
      content: 'Hey, want to work out together?'
    };

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${token}`)
      .send(messageData);

    // Then retrieve the conversation
    const response = await request(app)
      .get(`/api/messages/${otherUserId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body).toHaveProperty('messages');
    expect(Array.isArray(response.body.messages)).toBeTruthy();
    expect(response.body.messages.length).toBe(1);
    expect(response.body.messages[0].content).toBe(messageData.content);
    expect(response.body.messages[0].sender).toBe('me');
  });
});