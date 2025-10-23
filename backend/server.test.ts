import request from 'supertest';
import { app, pool } from './server.ts';
import jwt from 'jsonwebtoken';

// Test data based on seed data
const testUsers = {
  host: {
    user_id: 'user_001',
    email: 'ahmed.ali@example.com',
    password: 'password123',
    name: 'Ahmed Ali',
    role: 'host'
  },
  guest: {
    user_id: 'user_002',
    email: 'sara.mohamed@example.com',
    password: 'user123',
    name: 'Sara Mohamed',
    role: 'guest'
  },
  admin: {
    user_id: 'user_005',
    email: 'admin.ly@example.com',
    password: 'admin123',
    name: 'Ly Admin',
    role: 'admin'
  }
};

const testProperties = {
  property1: {
    property_id: 'prop_001',
    title: 'Luxury Apartment in Tripoli',
    city: 'Tripoli',
    host_id: 'user_001'
  }
};

const testBookings = {
  booking1: {
    booking_id: 'book_001',
    property_id: 'prop_001',
    guest_id: 'user_002',
    host_id: 'user_001',
    status: 'confirmed'
  }
};

// Helper functions
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.user_id, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

const authHeader = (user) => {
  return `Bearer ${generateToken(user)}`;
};

describe('LibyaStay API Tests', () => {
  let authTokenHost;
  let authTokenGuest;
  let authTokenAdmin;

  beforeAll(() => {
    authTokenHost = authHeader(testUsers.host);
    authTokenGuest = authHeader(testUsers.guest);
    authTokenAdmin = authHeader(testUsers.admin);
  });

  // Authentication Tests
  describe('Authentication', () => {
    test('should register a new user', async () => {
      const newUser = {
        email: 'new.user@example.com',
        phone_number: '+218910000100',
        password_hash: 'newpassword123',
        name: 'New User',
        role: 'guest'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body.user).toHaveProperty('user_id');
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.user.name).toBe(newUser.name);
      expect(response.body).toHaveProperty('token');
    });

    test('should login existing user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.host.email,
          password: testUsers.host.password
        })
        .expect(200);

      expect(response.body.user.email).toBe(testUsers.host.email);
      expect(response.body.user.name).toBe(testUsers.host.name);
      expect(response.body).toHaveProperty('token');
    });

    test('should fail login with invalid credentials', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUsers.host.email,
          password: 'wrongpassword'
        })
        .expect(401);
    });

    test('should logout authenticated user', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', authTokenHost)
        .expect(200);
    });
  });

  // User Management Tests
  describe('User Management', () => {
    test('should get user profile', async () => {
      const response = await request(app)
        .get(`/api/users/${testUsers.host.user_id}`)
        .expect(200);

      expect(response.body.user_id).toBe(testUsers.host.user_id);
      expect(response.body.email).toBe(testUsers.host.email);
    });

    test('should update user profile', async () => {
      const updateData = {
        user_id: testUsers.host.user_id,
        bio: 'Updated bio for testing'
      };

      const response = await request(app)
        .patch(`/api/users/${testUsers.host.user_id}`)
        .set('Authorization', authTokenHost)
        .send(updateData)
        .expect(200);

      expect(response.body.bio).toBe(updateData.bio);
    });

    test('should get user listings', async () => {
      const response = await request(app)
        .get(`/api/users/${testUsers.host.user_id}/listings`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should get user bookings', async () => {
      const response = await request(app)
        .get(`/api/users/${testUsers.guest.user_id}/bookings`)
        .set('Authorization', authTokenGuest)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should get user reviews', async () => {
      const response = await request(app)
        .get(`/api/users/${testUsers.host.user_id}/reviews`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should not update another user profile', async () => {
      const updateData = {
        user_id: testUsers.guest.user_id,
        bio: 'Trying to hack another user'
      };

      await request(app)
        .patch(`/api/users/${testUsers.guest.user_id}`)
        .set('Authorization', authTokenHost) // Using host token to update guest
        .send(updateData)
        .expect(403);
    });
  });

  // Property Management Tests
  describe('Property Management', () => {
    test('should search properties', async () => {
      const response = await request(app)
        .get('/api/properties')
        .query({ city: 'Tripoli' })
        .expect(200);

      expect(response.body).toHaveProperty('properties');
      expect(response.body).toHaveProperty('total_count');
      expect(Array.isArray(response.body.properties)).toBe(true);
    });

    test('should create property listing', async () => {
      const newProperty = {
        host_id: testUsers.host.user_id,
        title: 'Test Property',
        description: 'Beautiful test property',
        city: 'Tripoli',
        property_type: 'apartment',
        guest_capacity: 4,
        bedrooms: 2,
        beds: 3,
        bathrooms: 2,
        base_price_per_night: 100,
        cancellation_policy: 'moderate'
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', authTokenHost)
        .send(newProperty)
        .expect(201);

      expect(response.body.title).toBe(newProperty.title);
      expect(response.body.host_id).toBe(newProperty.host_id);
    });

    test('should get property details', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperties.property1.property_id}`)
        .expect(200);

      expect(response.body.property_id).toBe(testProperties.property1.property_id);
      expect(response.body.title).toBe(testProperties.property1.title);
    });

    test('should update property listing', async () => {
      const updateData = {
        property_id: testProperties.property1.property_id,
        title: 'Updated Luxury Apartment'
      };

      const response = await request(app)
        .patch(`/api/properties/${testProperties.property1.property_id}`)
        .set('Authorization', authTokenHost)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
    });

    test('should not update another host property', async () => {
      const updateData = {
        property_id: testProperties.property1.property_id,
        title: 'Hacker Attempt'
      };

      await request(app)
        .patch(`/api/properties/${testProperties.property1.property_id}`)
        .set('Authorization', authTokenGuest) // Guest trying to update host property
        .send(updateData)
        .expect(403);
    });

    test('should get property photos', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperties.property1.property_id}/photos`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should add property photo', async () => {
      const newPhoto = {
        property_id: testProperties.property1.property_id,
        photo_url: 'https://example.com/test-photo.jpg',
        display_order: 10
      };

      const response = await request(app)
        .post(`/api/properties/${testProperties.property1.property_id}/photos`)
        .set('Authorization', authTokenHost)
        .send(newPhoto)
        .expect(201);

      expect(response.body.photo_url).toBe(newPhoto.photo_url);
      expect(response.body.display_order).toBe(newPhoto.display_order);
    });

    test('should get property availability', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperties.property1.property_id}/availability`)
        .query({ start_date: '2023-06-01', end_date: '2023-06-05' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should set property availability', async () => {
      const availability = {
        property_id: testProperties.property1.property_id,
        date: '2023-07-01',
        is_available: true
      };

      const response = await request(app)
        .post(`/api/properties/${testProperties.property1.property_id}/availability`)
        .set('Authorization', authTokenHost)
        .send(availability)
        .expect(201);

      expect(response.body.date).toBe(availability.date);
      expect(response.body.is_available).toBe(availability.is_available);
    });

    test('should get property reviews', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperties.property1.property_id}/reviews`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  // Booking Management Tests
  describe('Booking Management', () => {
    test('should search bookings', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', authTokenAdmin)
        .query({ guest_id: testUsers.guest.user_id })
        .expect(200);

      expect(response.body).toHaveProperty('bookings');
      expect(response.body).toHaveProperty('total_count');
    });

    test('should create booking', async () => {
      const newBooking = {
        property_id: testProperties.property1.property_id,
        guest_id: testUsers.guest.user_id,
        host_id: testUsers.host.user_id,
        check_in: '2023-07-01',
        check_out: '2023-07-05',
        guest_count: 2,
        total_price: 500,
        service_fee: 50,
        status: 'pending'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', authTokenGuest)
        .send(newBooking)
        .expect(201);

      expect(response.body.property_id).toBe(newBooking.property_id);
      expect(response.body.guest_id).toBe(newBooking.guest_id);
      expect(response.body.status).toBe(newBooking.status);
    });

    test('should get booking details', async () => {
      const response = await request(app)
        .get(`/api/bookings/${testBookings.booking1.booking_id}`)
        .set('Authorization', authTokenHost)
        .expect(200);

      expect(response.body.booking_id).toBe(testBookings.booking1.booking_id);
    });

    test('should update booking status', async () => {
      const updateData = {
        booking_id: testBookings.booking1.booking_id,
        status: 'completed'
      };

      const response = await request(app)
        .patch(`/api/bookings/${testBookings.booking1.booking_id}`)
        .set('Authorization', authTokenHost)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe(updateData.status);
    });

    test('should not access another user booking', async () => {
      await request(app)
        .get(`/api/bookings/${testBookings.booking1.booking_id}`)
        .set('Authorization', authTokenAdmin) // Admin trying to access host/guest booking
        .expect(403);
    });
  });

  // Review Management Tests
  describe('Review Management', () => {
    test('should create review for booking', async () => {
      const newReview = {
        booking_id: testBookings.booking1.booking_id,
        property_id: testBookings.booking1.property_id,
        reviewer_id: testUsers.guest.user_id,
        host_id: testUsers.host.user_id,
        cleanliness_rating: 5,
        accuracy_rating: 5,
        communication_rating: 5,
        location_rating: 4,
        check_in_rating: 5,
        value_rating: 5,
        overall_rating: 5,
        comment: 'Amazing stay! Highly recommended.'
      };

      const response = await request(app)
        .post(`/api/bookings/${testBookings.booking1.booking_id}/reviews`)
        .set('Authorization', authTokenGuest)
        .send(newReview)
        .expect(201);

      expect(response.body.booking_id).toBe(newReview.booking_id);
      expect(response.body.overall_rating).toBe(newReview.overall_rating);
      expect(response.body.comment).toBe(newReview.comment);
    });
  });

  // Messaging Tests
  describe('Messaging System', () => {
    test('should get user conversations', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', authTokenHost)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should get conversation details', async () => {
      const response = await request(app)
        .get(`/api/conversations/conv_001`)
        .set('Authorization', authTokenHost)
        .expect(200);

      expect(response.body.conversation_id).toBe('conv_001');
    });

    test('should get conversation messages', async () => {
      const response = await request(app)
        .get(`/api/conversations/conv_001/messages`)
        .set('Authorization', authTokenHost)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should send message in conversation', async () => {
      const newMessage = {
        conversation_id: 'conv_001',
        sender_id: testUsers.host.user_id,
        content: 'Hello from test!'
      };

      const response = await request(app)
        .post(`/api/conversations/conv_001/messages`)
        .set('Authorization', authTokenHost)
        .send(newMessage)
        .expect(201);

      expect(response.body.content).toBe(newMessage.content);
      expect(response.body.sender_id).toBe(newMessage.sender_id);
    });

    test('should update message (mark as read)', async () => {
      // First, get a message to update
      const messagesRes = await request(app)
        .get(`/api/conversations/conv_001/messages`)
        .set('Authorization', authTokenHost);

      const messageId = messagesRes.body[0].message_id;
      
      const updateData = {
        message_id: messageId,
        is_read: true
      };

      const response = await request(app)
        .patch(`/api/messages/${messageId}`)
        .set('Authorization', authTokenHost)
        .send(updateData)
        .expect(200);

      expect(response.body.is_read).toBe(true);
    });
  });

  // Notification Tests
  describe('Notification System', () => {
    test('should get user notifications', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', authTokenHost)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should update notification (mark as read)', async () => {
      // First, get a notification to update
      const notificationsRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', authTokenHost);

      if (notificationsRes.body.length > 0) {
        const notificationId = notificationsRes.body[0].notification_id;
        
        const updateData = {
          notification_id: notificationId,
          is_read: true
        };

        const response = await request(app)
          .patch(`/api/notifications/${notificationId}`)
          .set('Authorization', authTokenHost)
          .send(updateData)
          .expect(200);

        expect(response.body.is_read).toBe(true);
      }
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    test('should return 404 for non-existent user', async () => {
      await request(app)
        .get('/api/users/non-existent-user-id')
        .expect(404);
    });

    test('should return 404 for non-existent property', async () => {
      await request(app)
        .get('/api/properties/non-existent-property-id')
        .expect(404);
    });

    test('should return 401 for unauthorized access', async () => {
      await request(app)
        .post('/api/properties')
        .send({}) // No auth header
        .expect(401);
    });

    test('should return 400 for invalid input data', async () => {
      const invalidProperty = {
        host_id: testUsers.host.user_id,
        // Missing required fields
      };

      await request(app)
        .post('/api/properties')
        .set('Authorization', authTokenHost)
        .send(invalidProperty)
        .expect(400);
    });
  });

  // Database Constraint Tests
  describe('Database Constraints', () => {
    test('should not allow duplicate email registration', async () => {
      const duplicateUser = {
        email: testUsers.host.email, // Duplicate email
        phone_number: '+218910000101',
        password_hash: 'password123',
        name: 'Duplicate User',
        role: 'guest'
      };

      await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409);
    });

    test('should enforce foreign key constraints', async () => {
      const invalidBooking = {
        property_id: 'non-existent-property',
        guest_id: testUsers.guest.user_id,
        host_id: testUsers.host.user_id,
        check_in: '2023-08-01',
        check_out: '2023-08-05',
        guest_count: 2,
        total_price: 500,
        service_fee: 50
      };

      await request(app)
        .post('/api/bookings')
        .set('Authorization', authTokenGuest)
        .send(invalidBooking)
        .expect(400); // Should fail due to foreign key constraint
    });
  });

  // WebSocket Tests - Simulate Events
  describe('WebSocket Events (Simulated)', () => {
    test('should simulate message:new event', async () => {
      // In a real test, we would connect to WebSocket and listen for events
      // For this test, we just verify the message creation triggers the right behavior
      const newMessage = {
        conversation_id: 'conv_001',
        sender_id: testUsers.host.user_id,
        content: 'WebSocket test message'
      };

      const response = await request(app)
        .post(`/api/conversations/conv_001/messages`)
        .set('Authorization', authTokenHost)
        .send(newMessage)
        .expect(201);

      // In a real WebSocket implementation, we would check if the event was emitted
      expect(response.body.content).toBe(newMessage.content);
    });

    test('should simulate booking:request event', async () => {
      const newBooking = {
        property_id: testProperties.property1.property_id,
        guest_id: testUsers.guest.user_id,
        host_id: testUsers.host.user_id,
        check_in: '2023-08-01',
        check_out: '2023-08-05',
        guest_count: 2,
        total_price: 500,
        service_fee: 50,
        status: 'pending'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', authTokenGuest)
        .send(newBooking)
        .expect(201);

      // The booking creation should trigger a notification for the host
      const notificationsRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', authTokenHost)
        .expect(200);

      const bookingNotification = notificationsRes.body.find(
        n => n.type === 'booking_request' && n.related_entity_id === response.body.booking_id
      );

      expect(bookingNotification).toBeDefined();
    });
  });
});