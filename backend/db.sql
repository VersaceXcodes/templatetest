-- Create tables
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    profile_picture_url TEXT,
    bio TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    role TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_document_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS properties (
    property_id TEXT PRIMARY KEY,
    host_id TEXT NOT NULL REFERENCES users(user_id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    city TEXT NOT NULL,
    neighborhood TEXT,
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    property_type TEXT NOT NULL,
    guest_capacity INTEGER NOT NULL,
    bedrooms INTEGER NOT NULL,
    beds INTEGER NOT NULL,
    bathrooms INTEGER NOT NULL,
    amenities TEXT,
    base_price_per_night NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'LYD',
    has_power_backup BOOLEAN NOT NULL DEFAULT FALSE,
    has_water_tank BOOLEAN NOT NULL DEFAULT FALSE,
    house_rules TEXT,
    cancellation_policy TEXT NOT NULL,
    instant_book BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_photos (
    photo_id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(property_id),
    photo_url TEXT NOT NULL,
    caption TEXT,
    display_order INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS property_availability (
    availability_id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(property_id),
    date TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    price_override NUMERIC
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES properties(property_id),
    guest_id TEXT NOT NULL REFERENCES users(user_id),
    host_id TEXT NOT NULL REFERENCES users(user_id),
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    guest_count INTEGER NOT NULL,
    total_price NUMERIC NOT NULL,
    service_fee NUMERIC NOT NULL,
    special_requests TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    conversation_id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(booking_id),
    guest_id TEXT NOT NULL REFERENCES users(user_id),
    host_id TEXT NOT NULL REFERENCES users(user_id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    message_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id),
    sender_id TEXT NOT NULL REFERENCES users(user_id),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
    review_id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(booking_id),
    property_id TEXT NOT NULL REFERENCES properties(property_id),
    reviewer_id TEXT NOT NULL REFERENCES users(user_id),
    host_id TEXT NOT NULL REFERENCES users(user_id),
    cleanliness_rating INTEGER NOT NULL,
    accuracy_rating INTEGER NOT NULL,
    communication_rating INTEGER NOT NULL,
    location_rating INTEGER NOT NULL,
    check_in_rating INTEGER NOT NULL,
    value_rating INTEGER NOT NULL,
    overall_rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_photos (
    photo_id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES reviews(review_id),
    photo_url TEXT NOT NULL,
    caption TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_actions (
    action_id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES users(user_id),
    action_type TEXT NOT NULL,
    target_entity_type TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_entity_type TEXT,
    related_entity_id TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL
);

-- Seed data
-- Users
INSERT INTO users (user_id, email, phone_number, password_hash, name, profile_picture_url, bio, emergency_contact_name, emergency_contact_phone, role, is_verified, verification_document_url, created_at, updated_at) VALUES
('user_001', 'ahmed.ali@example.com', '+218910000001', 'password123', 'Ahmed Ali', 'https://picsum.photos/200/200?random=1', 'Experienced host in Tripoli', 'Fatima Ali', '+218910000002', 'host', TRUE, 'https://picsum.photos/300/300?random=101', '2023-01-15T10:00:00Z', '2023-01-15T10:00:00Z'),
('user_002', 'sara.mohamed@example.com', '+218910000003', 'user123', 'Sara Mohamed', 'https://picsum.photos/200/200?random=2', 'Travel enthusiast', NULL, NULL, 'guest', TRUE, NULL, '2023-01-20T10:00:00Z', '2023-01-20T10:00:00Z'),
('user_003', 'omar.hassan@example.com', '+218910000004', 'host123', 'Omar Hassan', 'https://picsum.photos/200/200?random=3', 'Property owner in Benghazi', 'Khalid Hassan', '+218910000005', 'host', TRUE, 'https://picsum.photos/300/300?random=102', '2023-02-01T10:00:00Z', '2023-02-01T10:00:00Z'),
('user_004', 'mariam.essa@example.com', '+218910000006', 'guest123', 'Mariam Essa', 'https://picsum.photos/200/200?random=4', 'Frequent traveler', NULL, NULL, 'guest', TRUE, NULL, '2023-02-05T10:00:00Z', '2023-02-05T10:00:00Z'),
('user_005', 'admin.ly@example.com', '+218910000007', 'admin123', 'Ly Admin', 'https://picsum.photos/200/200?random=5', 'System Administrator', NULL, NULL, 'admin', TRUE, NULL, '2023-01-01T10:00:00Z', '2023-01-01T10:00:00Z')
ON CONFLICT (user_id) DO NOTHING;

-- Properties
INSERT INTO properties (property_id, host_id, title, description, city, neighborhood, address, latitude, longitude, property_type, guest_capacity, bedrooms, beds, bathrooms, amenities, base_price_per_night, currency, has_power_backup, has_water_tank, house_rules, cancellation_policy, instant_book, is_active, created_at, updated_at) VALUES
('prop_001', 'user_001', 'Luxury Apartment in Tripoli', 'Beautiful modern apartment in the heart of Tripoli with stunning sea views.', 'Tripoli', 'Al-Hadba', '123 Al-Fateh Street', 32.8872, 13.1913, 'apartment', 4, 2, 3, 2, 'WiFi,Air Conditioning,Balcony,Kitchen,Parking', 150, 'LYD', TRUE, TRUE, 'No smoking,No pets', 'moderate', TRUE, TRUE, '2023-01-20T10:00:00Z', '2023-01-20T10:00:00Z'),
('prop_002', 'user_001', 'Cozy Studio near Beach', 'Charming studio close to the beach with all modern amenities.', 'Tripoli', 'Al-Mahatta', '45 Beach Road', 32.8761, 13.1867, 'studio', 2, 1, 1, 1, 'WiFi,Air Conditioning,Kitchen,TV', 80, 'LYD', TRUE, FALSE, 'Quiet hours after 10 PM', 'flexible', FALSE, TRUE, '2023-01-25T10:00:00Z', '2023-01-25T10:00:00Z'),
('prop_003', 'user_003', 'Traditional House in Benghazi', 'Experience traditional Libyan hospitality in this beautiful old town house.', 'Benghazi', 'Al-Wahda', '789 Al-Mujtahid Street', 32.1149, 20.0691, 'house', 6, 3, 4, 2, 'WiFi,Patio,Garden,Kitchen,Washer', 120, 'LYD', FALSE, TRUE, 'Respect for cultural traditions', 'strict', FALSE, TRUE, '2023-02-05T10:00:00Z', '2023-02-05T10:00:00Z')
ON CONFLICT (property_id) DO NOTHING;

-- Property Photos
INSERT INTO property_photos (photo_id, property_id, photo_url, caption, display_order, created_at) VALUES
('photo_001', 'prop_001', 'https://picsum.photos/800/600?random=201', 'Living room with sea view', 1, '2023-01-20T10:00:00Z'),
('photo_002', 'prop_001', 'https://picsum.photos/800/600?random=202', 'Master bedroom', 2, '2023-01-20T10:00:00Z'),
('photo_003', 'prop_001', 'https://picsum.photos/800/600?random=203', 'Kitchen', 3, '2023-01-20T10:00:00Z'),
('photo_004', 'prop_002', 'https://picsum.photos/800/600?random=204', 'Studio interior', 1, '2023-01-25T10:00:00Z'),
('photo_005', 'prop_002', 'https://picsum.photos/800/600?random=205', 'Bathroom', 2, '2023-01-25T10:00:00Z'),
('photo_006', 'prop_003', 'https://picsum.photos/800/600?random=206', 'Traditional courtyard', 1, '2023-02-05T10:00:00Z'),
('photo_007', 'prop_003', 'https://picsum.photos/800/600?random=207', 'Bedroom with traditional decor', 2, '2023-02-05T10:00:00Z')
ON CONFLICT (photo_id) DO NOTHING;

-- Property Availability
INSERT INTO property_availability (availability_id, property_id, date, is_available, price_override) VALUES
('avail_001', 'prop_001', '2023-06-01', TRUE, NULL),
('avail_002', 'prop_001', '2023-06-02', TRUE, 160),
('avail_003', 'prop_001', '2023-06-03', FALSE, NULL),
('avail_004', 'prop_002', '2023-06-01', TRUE, NULL),
('avail_005', 'prop_002', '2023-06-02', TRUE, NULL),
('avail_006', 'prop_003', '2023-06-01', TRUE, NULL)
ON CONFLICT (availability_id) DO NOTHING;

-- Bookings
INSERT INTO bookings (booking_id, property_id, guest_id, host_id, check_in, check_out, guest_count, total_price, service_fee, special_requests, status, created_at, updated_at) VALUES
('book_001', 'prop_001', 'user_002', 'user_001', '2023-06-01', '2023-06-05', 2, 650, 65, 'Late check-in around 10 PM', 'confirmed', '2023-05-01T10:00:00Z', '2023-05-01T10:00:00Z'),
('book_002', 'prop_003', 'user_004', 'user_003', '2023-06-10', '2023-06-15', 4, 650, 65, 'Celebrating anniversary', 'pending', '2023-05-15T10:00:00Z', '2023-05-15T10:00:00Z')
ON CONFLICT (booking_id) DO NOTHING;

-- Conversations
INSERT INTO conversations (conversation_id, booking_id, guest_id, host_id, created_at, updated_at) VALUES
('conv_001', 'book_001', 'user_002', 'user_001', '2023-05-01T10:05:00Z', '2023-05-01T10:05:00Z'),
('conv_002', 'book_002', 'user_004', 'user_003', '2023-05-15T10:05:00Z', '2023-05-15T10:05:00Z')
ON CONFLICT (conversation_id) DO NOTHING;

-- Messages
INSERT INTO messages (message_id, conversation_id, sender_id, content, is_read, created_at) VALUES
('msg_001', 'conv_001', 'user_002', 'Hi Ahmed, I''m excited about our upcoming stay. Could you provide directions to your apartment?', FALSE, '2023-05-01T10:10:00Z'),
('msg_002', 'conv_001', 'user_001', 'Hello Sara! I''ll send you detailed directions 24 hours before your arrival.', TRUE, '2023-05-01T11:15:00Z'),
('msg_003', 'conv_002', 'user_004', 'Hello Omar, we''re looking forward to celebrating our anniversary at your beautiful house.', FALSE, '2023-05-15T10:10:00Z')
ON CONFLICT (message_id) DO NOTHING;

-- Reviews
INSERT INTO reviews (review_id, booking_id, property_id, reviewer_id, host_id, cleanliness_rating, accuracy_rating, communication_rating, location_rating, check_in_rating, value_rating, overall_rating, comment, created_at, updated_at) VALUES
('rev_001', 'book_001', 'prop_001', 'user_002', 'user_001', 5, 5, 5, 4, 5, 5, 5, 'Amazing stay! Ahmed was a wonderful host and the apartment was exactly as described.', '2023-06-06T10:00:00Z', '2023-06-06T10:00:00Z')
ON CONFLICT (review_id) DO NOTHING;

-- Review Photos
INSERT INTO review_photos (photo_id, review_id, photo_url, caption, created_at) VALUES
('rphoto_001', 'rev_001', 'https://picsum.photos/800/600?random=301', 'View from the balcony', '2023-06-06T10:00:00Z')
ON CONFLICT (photo_id) DO NOTHING;

-- Admin Actions
INSERT INTO admin_actions (action_id, admin_id, action_type, target_entity_type, target_entity_id, details, created_at) VALUES
('act_001', 'user_005', 'property_approved', 'property', 'prop_001', 'Verified property details and photos', '2023-01-20T11:00:00Z'),
('act_002', 'user_005', 'user_verified', 'user', 'user_001', 'Verified government ID and documents', '2023-01-20T11:30:00Z')
ON CONFLICT (action_id) DO NOTHING;

-- Notifications
INSERT INTO notifications (notification_id, user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at) VALUES
('not_001', 'user_001', 'booking_request', 'New Booking Request', 'You have a new booking request for Luxury Apartment in Tripoli', 'booking', 'book_001', FALSE, '2023-05-01T10:00:00Z'),
('not_002', 'user_002', 'booking_confirmed', 'Booking Confirmed', 'Your booking for Luxury Apartment in Tripoli has been confirmed', 'booking', 'book_001', TRUE, '2023-05-01T12:00:00Z'),
('not_003', 'user_003', 'booking_request', 'New Booking Request', 'You have a new booking request for Traditional House in Benghazi', 'booking', 'book_002', FALSE, '2023-05-15T10:00:00Z')
ON CONFLICT (notification_id) DO NOTHING;