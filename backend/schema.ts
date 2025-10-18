import { z } from 'zod';

// User Schemas
export const userSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  phone_number: z.string(),
  password_hash: z.string(),
  name: z.string(),
  profile_picture_url: z.string().nullable(),
  bio: z.string().nullable(),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  role: z.string(),
  is_verified: z.boolean(),
  verification_document_url: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createUserInputSchema = z.object({
  email: z.string().email().min(1).max(255),
  phone_number: z.string().min(1).max(20),
  password_hash: z.string().min(8).max(255),
  name: z.string().min(1).max(100),
  profile_picture_url: z.string().url().nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  emergency_contact_name: z.string().max(100).nullable().optional(),
  emergency_contact_phone: z.string().max(20).nullable().optional(),
  role: z.enum(['guest', 'host', 'admin', 'traveler', 'both']).transform(val => {
    // Map frontend roles to backend roles
    if (val === 'traveler') return 'guest';
    if (val === 'both') return 'host'; // Users with 'both' role can host
    return val;
  }),
  is_verified: z.boolean().optional(),
  verification_document_url: z.string().url().nullable().optional()
});

export const updateUserInputSchema = z.object({
  user_id: z.string(),
  email: z.string().email().min(1).max(255).optional(),
  phone_number: z.string().min(1).max(20).optional(),
  password_hash: z.string().min(8).max(255).optional(),
  name: z.string().min(1).max(100).optional(),
  profile_picture_url: z.string().url().nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  emergency_contact_name: z.string().max(100).nullable().optional(),
  emergency_contact_phone: z.string().max(20).nullable().optional(),
  role: z.enum(['guest', 'host', 'admin', 'traveler', 'both']).transform(val => {
    // Map frontend roles to backend roles
    if (val === 'traveler') return 'guest';
    if (val === 'both') return 'host'; // Users with 'both' role can host
    return val;
  }).optional(),
  is_verified: z.boolean().optional(),
  verification_document_url: z.string().url().nullable().optional()
});

export const searchUserInputSchema = z.object({
  query: z.string().optional(),
  role: z.enum(['guest', 'host', 'admin']).optional(),
  is_verified: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['name', 'created_at', 'email']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type SearchUserInput = z.infer<typeof searchUserInputSchema>;

// Property Schemas
export const propertySchema = z.object({
  property_id: z.string(),
  host_id: z.string(),
  title: z.string(),
  description: z.string(),
  city: z.string(),
  neighborhood: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  property_type: z.string(),
  guest_capacity: z.number().int(),
  bedrooms: z.number().int(),
  beds: z.number().int(),
  bathrooms: z.number().int(),
  amenities: z.string().nullable(),
  base_price_per_night: z.number(),
  currency: z.string(),
  has_power_backup: z.boolean(),
  has_water_tank: z.boolean(),
  house_rules: z.string().nullable(),
  cancellation_policy: z.string(),
  instant_book: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createPropertyInputSchema = z.object({
  host_id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  city: z.string().min(1).max(100),
  neighborhood: z.string().max(100).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  property_type: z.string().min(1).max(50),
  guest_capacity: z.number().int().positive(),
  bedrooms: z.number().int().nonnegative(),
  beds: z.number().int().positive(),
  bathrooms: z.number().int().positive(),
  amenities: z.string().max(1000).nullable().optional(),
  base_price_per_night: z.number().positive(),
  currency: z.string().min(3).max(3).default('LYD'),
  has_power_backup: z.boolean().default(false),
  has_water_tank: z.boolean().default(false),
  house_rules: z.string().max(1000).nullable().optional(),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']),
  instant_book: z.boolean().default(false),
  is_active: z.boolean().default(true)
});

export const updatePropertyInputSchema = z.object({
  property_id: z.string(),
  host_id: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  city: z.string().min(1).max(100).optional(),
  neighborhood: z.string().max(100).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  property_type: z.string().min(1).max(50).optional(),
  guest_capacity: z.number().int().positive().optional(),
  bedrooms: z.number().int().nonnegative().optional(),
  beds: z.number().int().positive().optional(),
  bathrooms: z.number().int().positive().optional(),
  amenities: z.string().max(1000).nullable().optional(),
  base_price_per_night: z.number().positive().optional(),
  currency: z.string().min(3).max(3).optional(),
  has_power_backup: z.boolean().optional(),
  has_water_tank: z.boolean().optional(),
  house_rules: z.string().max(1000).nullable().optional(),
  cancellation_policy: z.enum(['flexible', 'moderate', 'strict']).optional(),
  instant_book: z.boolean().optional(),
  is_active: z.boolean().optional()
});

export const searchPropertyInputSchema = z.object({
  query: z.string().optional(),
  city: z.string().optional(),
  property_type: z.string().optional(),
  guest_capacity: z.number().int().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  has_power_backup: z.boolean().optional(),
  has_water_tank: z.boolean().optional(),
  instant_book: z.boolean().optional(),
  is_active: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['title', 'base_price_per_night', 'created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Property = z.infer<typeof propertySchema>;
export type CreatePropertyInput = z.infer<typeof createPropertyInputSchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertyInputSchema>;
export type SearchPropertyInput = z.infer<typeof searchPropertyInputSchema>;

// Property Photo Schemas
export const propertyPhotoSchema = z.object({
  photo_id: z.string(),
  property_id: z.string(),
  photo_url: z.string(),
  caption: z.string().nullable(),
  display_order: z.number().int(),
  created_at: z.coerce.date()
});

export const createPropertyPhotoInputSchema = z.object({
  property_id: z.string().min(1),
  photo_url: z.string().url().min(1),
  caption: z.string().max(255).nullable().optional(),
  display_order: z.number().int().nonnegative()
});

export const updatePropertyPhotoInputSchema = z.object({
  photo_id: z.string(),
  property_id: z.string().optional(),
  photo_url: z.string().url().min(1).optional(),
  caption: z.string().max(255).nullable().optional(),
  display_order: z.number().int().nonnegative().optional()
});

export const searchPropertyPhotoInputSchema = z.object({
  property_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['display_order', 'created_at']).default('display_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type PropertyPhoto = z.infer<typeof propertyPhotoSchema>;
export type CreatePropertyPhotoInput = z.infer<typeof createPropertyPhotoInputSchema>;
export type UpdatePropertyPhotoInput = z.infer<typeof updatePropertyPhotoInputSchema>;
export type SearchPropertyPhotoInput = z.infer<typeof searchPropertyPhotoInputSchema>;

// Property Availability Schemas
export const propertyAvailabilitySchema = z.object({
  availability_id: z.string(),
  property_id: z.string(),
  date: z.coerce.date(),
  is_available: z.boolean(),
  price_override: z.number().nullable()
});

export const createPropertyAvailabilityInputSchema = z.object({
  property_id: z.string().min(1),
  date: z.coerce.date(),
  is_available: z.boolean().default(true),
  price_override: z.number().positive().nullable().optional()
});

export const updatePropertyAvailabilityInputSchema = z.object({
  availability_id: z.string(),
  property_id: z.string().optional(),
  date: z.coerce.date().optional(),
  is_available: z.boolean().optional(),
  price_override: z.number().positive().nullable().optional()
});

export const searchPropertyAvailabilityInputSchema = z.object({
  property_id: z.string().optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  is_available: z.boolean().optional(),
  limit: z.number().int().positive().default(30),
  offset: z.number().int().nonnegative().default(0)
});

export type PropertyAvailability = z.infer<typeof propertyAvailabilitySchema>;
export type CreatePropertyAvailabilityInput = z.infer<typeof createPropertyAvailabilityInputSchema>;
export type UpdatePropertyAvailabilityInput = z.infer<typeof updatePropertyAvailabilityInputSchema>;
export type SearchPropertyAvailabilityInput = z.infer<typeof searchPropertyAvailabilityInputSchema>;

// Booking Schemas
export const bookingSchema = z.object({
  booking_id: z.string(),
  property_id: z.string(),
  guest_id: z.string(),
  host_id: z.string(),
  check_in: z.coerce.date(),
  check_out: z.coerce.date(),
  guest_count: z.number().int(),
  total_price: z.number(),
  service_fee: z.number(),
  special_requests: z.string().nullable(),
  status: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createBookingInputSchema = z.object({
  property_id: z.string().min(1),
  guest_id: z.string().min(1).optional(), // Will be set by server
  check_in: z.coerce.date(),
  check_out: z.coerce.date(),
  guest_count: z.number().int().positive(),
  total_price: z.number().nonnegative(),
  service_fee: z.number().nonnegative(),
  special_requests: z.string().max(500).nullable().optional(),
  status: z.enum(['pending', 'confirmed', 'declined', 'cancelled', 'completed']).default('pending')
});

export const updateBookingInputSchema = z.object({
  booking_id: z.string(),
  property_id: z.string().optional(),
  guest_id: z.string().optional(),
  host_id: z.string().optional(),
  check_in: z.coerce.date().optional(),
  check_out: z.coerce.date().optional(),
  guest_count: z.number().int().positive().optional(),
  total_price: z.number().nonnegative().optional(),
  service_fee: z.number().nonnegative().optional(),
  special_requests: z.string().max(500).nullable().optional(),
  status: z.enum(['pending', 'confirmed', 'declined', 'cancelled', 'completed']).optional()});

export const searchBookingInputSchema = z.object({
  property_id: z.string().optional(),
  guest_id: z.string().optional(),
  host_id: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'declined', 'cancelled', 'completed']).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['check_in', 'check_out', 'created_at', 'total_price']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Booking = z.infer<typeof bookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;
export type SearchBookingInput = z.infer<typeof searchBookingInputSchema>;

// Conversation Schemas
export const conversationSchema = z.object({
  conversation_id: z.string(),
  booking_id: z.string(),
  guest_id: z.string(),
  host_id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createConversationInputSchema = z.object({
  booking_id: z.string().min(1),
  guest_id: z.string().min(1),
  host_id: z.string().min(1)
});

export const updateConversationInputSchema = z.object({
  conversation_id: z.string(),
  booking_id: z.string().optional(),
  guest_id: z.string().optional(),
  host_id: z.string().optional()
});

export const searchConversationInputSchema = z.object({
  booking_id: z.string().optional(),
  guest_id: z.string().optional(),
  host_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'updated_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Conversation = z.infer<typeof conversationSchema>;
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationInputSchema>;
export type SearchConversationInput = z.infer<typeof searchConversationInputSchema>;

// Message Schemas
export const messageSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string(),
  sender_id: z.string(),
  content: z.string(),
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export const createMessageInputSchema = z.object({
  conversation_id: z.string().min(1),
  sender_id: z.string().min(1),
  content: z.string().min(1).max(1000)
});

export const updateMessageInputSchema = z.object({
  message_id: z.string(),
  conversation_id: z.string().optional(),
  sender_id: z.string().optional(),
  content: z.string().min(1).max(1000).optional(),
  is_read: z.boolean().optional()
});

export const searchMessageInputSchema = z.object({
  conversation_id: z.string().optional(),
  sender_id: z.string().optional(),
  is_read: z.boolean().optional(),
  limit: z.number().int().positive().default(20),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('asc')
});

export type Message = z.infer<typeof messageSchema>;
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;
export type SearchMessageInput = z.infer<typeof searchMessageInputSchema>;

// Review Schemas
export const reviewSchema = z.object({
  review_id: z.string(),
  booking_id: z.string(),
  property_id: z.string(),
  reviewer_id: z.string(),
  host_id: z.string(),
  cleanliness_rating: z.number().int().min(1).max(5),
  accuracy_rating: z.number().int().min(1).max(5),
  communication_rating: z.number().int().min(1).max(5),
  location_rating: z.number().int().min(1).max(5),
  check_in_rating: z.number().int().min(1).max(5),
  value_rating: z.number().int().min(1).max(5),
  overall_rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export const createReviewInputSchema = z.object({
  booking_id: z.string().min(1),
  property_id: z.string().min(1),
  reviewer_id: z.string().min(1),
  host_id: z.string().min(1),
  cleanliness_rating: z.number().int().min(1).max(5),
  accuracy_rating: z.number().int().min(1).max(5),
  communication_rating: z.number().int().min(1).max(5),
  location_rating: z.number().int().min(1).max(5),
  check_in_rating: z.number().int().min(1).max(5),
  value_rating: z.number().int().min(1).max(5),
  overall_rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional()
});

export const updateReviewInputSchema = z.object({
  review_id: z.string(),
  booking_id: z.string().optional(),
  property_id: z.string().optional(),
  reviewer_id: z.string().optional(),
  host_id: z.string().optional(),
  cleanliness_rating: z.number().int().min(1).max(5).optional(),
  accuracy_rating: z.number().int().min(1).max(5).optional(),
  communication_rating: z.number().int().min(1).max(5).optional(),
  location_rating: z.number().int().min(1).max(5).optional(),
  check_in_rating: z.number().int().min(1).max(5).optional(),
  value_rating: z.number().int().min(1).max(5).optional(),
  overall_rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).nullable().optional()
});

export const searchReviewInputSchema = z.object({
  property_id: z.string().optional(),
  reviewer_id: z.string().optional(),
  host_id: z.string().optional(),
  min_rating: z.number().int().min(1).max(5).optional(),
  max_rating: z.number().int().min(1).max(5).optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at', 'overall_rating']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Review = z.infer<typeof reviewSchema>;
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;
export type SearchReviewInput = z.infer<typeof searchReviewInputSchema>;

// Review Photo Schemas
export const reviewPhotoSchema = z.object({
  photo_id: z.string(),
  review_id: z.string(),
  photo_url: z.string(),
  caption: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createReviewPhotoInputSchema = z.object({
  review_id: z.string().min(1),
  photo_url: z.string().url().min(1),
  caption: z.string().max(255).nullable().optional()
});

export const updateReviewPhotoInputSchema = z.object({
  photo_id: z.string(),
  review_id: z.string().optional(),
  photo_url: z.string().url().min(1).optional(),
  caption: z.string().max(255).nullable().optional()
});

export const searchReviewPhotoInputSchema = z.object({
  review_id: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0)
});

export type ReviewPhoto = z.infer<typeof reviewPhotoSchema>;
export type CreateReviewPhotoInput = z.infer<typeof createReviewPhotoInputSchema>;
export type UpdateReviewPhotoInput = z.infer<typeof updateReviewPhotoInputSchema>;
export type SearchReviewPhotoInput = z.infer<typeof searchReviewPhotoInputSchema>;

// Admin Action Schemas
export const adminActionSchema = z.object({
  action_id: z.string(),
  admin_id: z.string(),
  action_type: z.string(),
  target_entity_type: z.string(),
  target_entity_id: z.string(),
  details: z.string().nullable(),
  created_at: z.coerce.date()
});

export const createAdminActionInputSchema = z.object({
  admin_id: z.string().min(1),
  action_type: z.string().min(1).max(100),
  target_entity_type: z.string().min(1).max(50),
  target_entity_id: z.string().min(1),
  details: z.string().max(1000).nullable().optional()
});

export const updateAdminActionInputSchema = z.object({
  action_id: z.string(),
  admin_id: z.string().optional(),
  action_type: z.string().min(1).max(100).optional(),
  target_entity_type: z.string().min(1).max(50).optional(),
  target_entity_id: z.string().min(1).optional(),
  details: z.string().max(1000).nullable().optional()
});

export const searchAdminActionInputSchema = z.object({
  admin_id: z.string().optional(),
  action_type: z.string().optional(),
  target_entity_type: z.string().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type AdminAction = z.infer<typeof adminActionSchema>;
export type CreateAdminActionInput = z.infer<typeof createAdminActionInputSchema>;
export type UpdateAdminActionInput = z.infer<typeof updateAdminActionInputSchema>;
export type SearchAdminActionInput = z.infer<typeof searchAdminActionInputSchema>;

// Notification Schemas
export const notificationSchema = z.object({
  notification_id: z.string(),
  user_id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  related_entity_type: z.string().nullable(),
  related_entity_id: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.coerce.date()
});

export const createNotificationInputSchema = z.object({
  user_id: z.string().min(1),
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  related_entity_type: z.string().max(50).nullable().optional(),
  related_entity_id: z.string().max(100).nullable().optional(),
  is_read: z.boolean().default(false)
});

export const updateNotificationInputSchema = z.object({
  notification_id: z.string(),
  user_id: z.string().optional(),
  type: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(1000).optional(),
  related_entity_type: z.string().max(50).nullable().optional(),
  related_entity_id: z.string().max(100).nullable().optional(),
  is_read: z.boolean().optional()
});

export const searchNotificationInputSchema = z.object({
  user_id: z.string().optional(),
  type: z.string().optional(),
  is_read: z.boolean().optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0),
  sort_by: z.enum(['created_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationInputSchema>;
export type SearchNotificationInput = z.infer<typeof searchNotificationInputSchema>;