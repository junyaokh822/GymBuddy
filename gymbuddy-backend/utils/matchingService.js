const User = require("../models/User");
const CalendarEvent = require("../models/CalendarEvent");
const mongoose = require("mongoose");

/**
 * Find potential gym buddies based on matching schedules, preferences, and time compatibility
 * @param {string} userId - The current user's ID
 * @param {number} threshold - Minimum hours of overlapping schedule to consider a match
 * @param {number} daysAhead - Number of days ahead to check for matches
 * @returns {Promise<Array>} - Array of potential matches with user info and compatibility score
 */
async function findPotentialBuddies(userId, threshold = 0.5, daysAhead = 14) {
  try {
    console.log(`START findPotentialBuddies for userId: ${userId}`);
    
    // Verify userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }

    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      throw new Error(`User not found for ID: ${userId}`);
    }
    console.log(`Found current user: ${currentUser.firstname} ${currentUser.lastname}`);

    // Get current user's preferences 
    const userPreferences = Array.isArray(currentUser.preferences) ? currentUser.preferences : [];
    console.log(`User preferences: ${userPreferences.join(', ')}`);
    
    // Calculate date range for finding events
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + daysAhead);
    
    // Get current user's events within the date range - don't filter by end date
    console.log(`Fetching user events from ${now.toISOString()}`);
    const userEvents = await CalendarEvent.find({
      userId: userId,
      start: { $gte: now }
    });
    console.log(`Found ${userEvents.length} events for current user`);
    
    if (userEvents.length === 0) {
      console.log("WARNING: User has no scheduled events in calendar");
    }
    
    // Find all other users to match with (we'll match based on preferences even if no shared events)
    const otherUsers = await User.find({ _id: { $ne: userId } });
    console.log(`Found ${otherUsers.length} other users to potentially match with`);
    
    if (otherUsers.length === 0) {
      return []; // No other users to match with
    }
    
    // Find all shared events by other users
    const sharedEvents = await CalendarEvent.find({
      userId: { $ne: userId },
      shared: true,
      start: { $gte: now }
    }).populate('userId');
    
    console.log(`Found ${sharedEvents.length} shared events from other users`);
    
    // Group events by userId
    const userEventsMap = {};
    
    // First, initialize all other users in the map (so we include users with preferences but no events)
    otherUsers.forEach(user => {
      userEventsMap[user._id.toString()] = {
        user: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          preferences: Array.isArray(user.preferences) ? user.preferences : []
        },
        events: [],
        overlapHours: 0,
        preferenceMatch: 0
      };
    });
    
    // Then add all the shared events
    sharedEvents.forEach(event => {
      // Handle possible issues with userId population
      if (!event.userId) {
        console.log(`Event ${event._id} has no userId, skipping`);
        return;
      }
      
      let otherUserId;
      
      // Handle both populated documents and ObjectId references
      if (typeof event.userId === 'object' && event.userId._id) {
        otherUserId = event.userId._id.toString();
      } else {
        otherUserId = event.userId.toString();
      }
      
      if (!userEventsMap[otherUserId]) {
        console.log(`Creating new entry for user ${otherUserId} not previously found`);
        // This shouldn't happen as we preloaded all users, but handle it just in case
        userEventsMap[otherUserId] = {
          user: {
            _id: otherUserId,
            firstname: 'Unknown',
            lastname: 'User',
            email: '',
            preferences: []
          },
          events: [],
          overlapHours: 0,
          preferenceMatch: 0
        };
        
        // Try to get the user to properly populate
        User.findById(otherUserId).then(user => {
          if (user) {
            userEventsMap[otherUserId].user = {
              _id: user._id,
              firstname: user.firstname,
              lastname: user.lastname,
              email: user.email,
              preferences: Array.isArray(user.preferences) ? user.preferences : []
            };
          }
        }).catch(err => {
          console.error(`Error fetching user ${otherUserId}:`, err);
        });
      }
      
      userEventsMap[otherUserId].events.push(event);
    });
    
    // Calculate overlapping hours and preference matches
    const potentialMatches = [];
    
    for (const otherUserId in userEventsMap) {
      const matchData = userEventsMap[otherUserId];
      let totalOverlapHours = 0;
      
      console.log(`\nCalculating match with ${matchData.user.firstname} ${matchData.user.lastname}`);
      console.log(`They have ${matchData.events.length} shared events`);
      
      // Calculate schedule overlap if both users have events
      if (userEvents.length > 0 && matchData.events.length > 0) {
        for (const userEvent of userEvents) {
          for (const otherEvent of matchData.events) {
            const overlap = calculateTimeOverlap(
              userEvent.start, userEvent.end,
              otherEvent.start, otherEvent.end
            );
            
            if (overlap > 0) {
              console.log(`Found overlap of ${overlap.toFixed(2)} hours between events`);
              console.log(`  User event: ${userEvent.title} (${new Date(userEvent.start).toLocaleString()} - ${new Date(userEvent.end).toLocaleString()})`);
              console.log(`  Other event: ${otherEvent.title} (${new Date(otherEvent.start).toLocaleString()} - ${new Date(otherEvent.end).toLocaleString()})`);
            }
            
            totalOverlapHours += overlap;
          }
        }
      }
      
      console.log(`Total overlap hours with ${matchData.user.firstname}: ${totalOverlapHours.toFixed(2)}`);
      
      // Calculate preference match percentage
      const userPrefs = new Set(userPreferences);
      const otherPrefs = new Set(matchData.user.preferences);
      
      // Count shared preferences
      const sharedPrefs = [...userPrefs].filter(pref => otherPrefs.has(pref));
      console.log(`Shared preferences: ${sharedPrefs.join(', ')}`);
      
      const uniquePrefs = new Set([...userPrefs, ...otherPrefs]);
      
      // Calculate Jaccard similarity coefficient (intersection over union)
      const prefMatchScore = uniquePrefs.size > 0 ? 
        sharedPrefs.length / uniquePrefs.size : 0;
      
      console.log(`Preference match score: ${(prefMatchScore * 100).toFixed(0)}%`);
      
      // Consider as a match if either: 
      // 1. They meet the schedule overlap threshold, or
      // 2. They have at least one shared preference
      if (totalOverlapHours >= threshold || sharedPrefs.length > 0) {
        console.log(`✅ ${matchData.user.firstname} is a match!`);
        
        // Store match with calculated compatibility scores
        potentialMatches.push({
          user: matchData.user,
          compatibilityScore: calculateCompatibilityScore(totalOverlapHours, prefMatchScore),
          overlapHours: Math.round(totalOverlapHours * 10) / 10, // Round to 1 decimal place
          preferenceMatch: Math.round(prefMatchScore * 100), // As percentage
          sharedPreferences: sharedPrefs
        });
      } else {
        console.log(`❌ ${matchData.user.firstname} is not a match (overlap: ${totalOverlapHours}, shared prefs: ${sharedPrefs.length})`);
      }
    }
    
    // Sort matches by compatibility score (highest first)
    const sortedMatches = potentialMatches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    console.log(`Returning ${sortedMatches.length} matches`);
    
    return sortedMatches;
    
  } catch (error) {
    console.error("Error finding potential buddies:", error);
    throw error;
  }
}

/**
 * Calculate hours of overlap between two time periods
 */
function calculateTimeOverlap(start1, end1, start2, end2) {
  // Ensure all inputs are Date objects
  const s1 = new Date(start1).getTime();
  const e1 = new Date(end1).getTime();
  const s2 = new Date(start2).getTime();
  const e2 = new Date(end2).getTime();
  
  // Check if there is an overlap
  if (s1 <= e2 && s2 <= e1) {
    // Calculate the overlap in milliseconds
    const overlapStart = Math.max(s1, s2);
    const overlapEnd = Math.min(e1, e2);
    const overlapMs = overlapEnd - overlapStart;
    
    // Return overlap in hours
    return overlapMs / (1000 * 60 * 60);
  }
  
  return 0; // No overlap
}

/**
 * Calculate overall compatibility score based on schedule overlap and preference match
 * Weight can be adjusted as needed (currently 50% schedule, 50% preferences)
 */
function calculateCompatibilityScore(overlapHours, preferenceMatch) {
  // Normalize overlap hours (assuming 5+ hours is maximum score)
  const normalizedOverlap = Math.min(overlapHours / 5, 1);
  
  // Combined weighted score (50% schedule, 50% preferences) - increasing preference importance
  return (normalizedOverlap * 0.5) + (preferenceMatch * 0.5);
}

module.exports = {
  findPotentialBuddies
};