const express = require('express');
const router = express.Router();
const Friend = require('../models/Friend');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/friends/request
 * Send a friend request to another user
 */
router.post('/request', async (req, res) => {
  try {
    const { recipientId } = req.body;
    
    // Get sender ID from authenticated user
    const senderId = req.user.id || req.user._id;
    
    // Don't allow sending request to self
    if (senderId.toString() === recipientId.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot send a friend request to yourself' 
      });
    }
    
    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }
    
    // Check if they are already friends
    const existingFriendship = await Friend.findOne({
      $or: [
        { user1: senderId, user2: recipientId },
        { user1: recipientId, user2: senderId }
      ]
    });
    
    if (existingFriendship) {
      return res.status(400).json({
        success: false,
        message: 'You are already friends with this user'
      });
    }
    
    // Check if there's a pending request from sender to recipient
    const existingRequest = await FriendRequest.findOne({
      sender: senderId,
      recipient: recipientId
    });
    
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'You already have a pending friend request to this user'
        });
      } else if (existingRequest.status === 'rejected') {
        // Update the rejected request to pending
        existingRequest.status = 'pending';
        await existingRequest.save();
        
        // Get sender information
        const sender = await User.findById(senderId);
        
        // Get socket.io instance
        const io = req.app.get('io');
        
        // If recipient is online, send real-time notification
        if (io) {
          io.to(recipientId.toString()).emit('friend_request', {
            requestId: existingRequest._id,
            from: {
              _id: sender._id,
              name: `${sender.firstname} ${sender.lastname}`
            }
          });
        }
        
        return res.status(200).json({
          success: true,
          message: 'Friend request sent again successfully',
          data: existingRequest
        });
      }
    }
    
    // Check if there's a pending request from recipient to sender
    const reciprocalRequest = await FriendRequest.findOne({
      sender: recipientId,
      recipient: senderId,
      status: 'pending'
    });
    
    if (reciprocalRequest) {
      // Auto-accept since both users want to be friends
      reciprocalRequest.status = 'accepted';
      await reciprocalRequest.save();
      
      // Create a new friendship
      const newFriendship = new Friend({
        user1: senderId,
        user2: recipientId
      });
      
      await newFriendship.save();
      
      // Get sender information
      const sender = await User.findById(senderId);
      
      // Get socket instance
      const io = req.app.get('io');
      
      // Notify both users
      if (io) {
        // Notify the recipient
        io.to(recipientId.toString()).emit('friend_request_accepted', {
          friendship: newFriendship._id,
          friend: {
            _id: sender._id,
            name: `${sender.firstname} ${sender.lastname}`
          }
        });
        
        // Notify the sender
        io.to(senderId.toString()).emit('friend_request_accepted', {
          friendship: newFriendship._id,
          friend: {
            _id: recipient._id,
            name: `${recipient.firstname} ${recipient.lastname}`
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Friend request automatically accepted as recipient had already sent you a request',
        friendship: newFriendship
      });
    }
    
    // Create a new friend request
    const newFriendRequest = new FriendRequest({
      sender: senderId,
      recipient: recipientId,
      status: 'pending'
    });
    
    await newFriendRequest.save();
    
    // Get sender information
    const sender = await User.findById(senderId);
    
    // Get socket instance
    const io = req.app.get('io');
    
    // Send real-time notification if recipient is online
    if (io) {
      io.to(recipientId.toString()).emit('friend_request', {
        requestId: newFriendRequest._id,
        from: {
          _id: sender._id,
          name: `${sender.firstname} ${sender.lastname}`
        }
      });
    }
    
    // Send email notification
    try {
      await sendEmail(
        recipient.email,
        'New Friend Request on GymBuddy',
        `
          <h2>Hi ${recipient.firstname},</h2>
          <p>${sender.firstname} ${sender.lastname} sent you a friend request on GymBuddy!</p>
          <p>Log in to your account to accept or decline this request.</p>
          <p>Happy workouts!</p>
          <p>- The GymBuddy Team</p>
        `
      );
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Continue even if email fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: newFriendRequest
    });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request',
      error: error.message
    });
  }
});

/**
 * GET /api/friends/requests/received
 * Get all friend requests received by current user
 */
router.get('/requests/received', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    const requests = await FriendRequest.find({
      recipient: userId,
      status: 'pending'
    })
    .populate('sender', 'firstname lastname email')
    .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error getting received friend requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve friend requests',
      error: error.message
    });
  }
});

/**
 * GET /api/friends/requests/sent
 * Get all friend requests sent by current user
 */
router.get('/requests/sent', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    const requests = await FriendRequest.find({
      sender: userId,
      status: 'pending'
    })
    .populate('recipient', 'firstname lastname email')
    .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    console.error('Error getting sent friend requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sent friend requests',
      error: error.message
    });
  }
});

/**
 * PUT /api/friends/requests/:requestId
 * Accept or reject a friend request
 */
router.put('/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    const userId = req.user.id || req.user._id;
    
    // Validate status
    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "accepted" or "rejected"'
      });
    }
    
    // Find the request
    const friendRequest = await FriendRequest.findById(requestId);
    
    if (!friendRequest) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }
    
    // Ensure the current user is the recipient
    if (friendRequest.recipient.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only respond to requests sent to you'
      });
    }
    
    // Check if request is already processed
    if (friendRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${friendRequest.status}`
      });
    }
    
    // Update the request status
    friendRequest.status = status;
    await friendRequest.save();
    
    // If accepted, create friendship entry
    let friendship = null;
    if (status === 'accepted') {
      friendship = new Friend({
        user1: friendRequest.sender,
        user2: friendRequest.recipient
      });
      
      await friendship.save();
      
      // Get user information for both users
      const [currentUser, sender] = await Promise.all([
        User.findById(userId, 'firstname lastname'),
        User.findById(friendRequest.sender, 'firstname lastname')
      ]);
      
      // Get socket instance
      const io = req.app.get('io');
      
      // Notify sender about acceptance
      if (io) {
        io.to(friendRequest.sender.toString()).emit('friend_request_accepted', {
          friendship: friendship._id,
          friend: {
            _id: currentUser._id,
            name: `${currentUser.firstname} ${currentUser.lastname}`
          }
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Friend request ${status}`,
      data: {
        request: friendRequest,
        friendship: friendship
      }
    });
  } catch (error) {
    console.error('Error processing friend request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process friend request',
      error: error.message
    });
  }
});

/**
 * GET /api/friends
 * Get all friends of the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    // Find all friendships involving the current user
    const friendships = await Friend.find({
      $or: [
        { user1: userId },
        { user2: userId }
      ]
    });
    
    // Extract friend IDs
    const friendIds = friendships.map(friendship => {
      return friendship.user1.toString() === userId.toString() ? 
        friendship.user2 : friendship.user1;
    });
    
    // Get friend details
    const friends = await User.find(
      { _id: { $in: friendIds } },
      'firstname lastname email preferences'
    );
    
    res.status(200).json({
      success: true,
      count: friends.length,
      data: friends
    });
  } catch (error) {
    console.error('Error getting friends list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve friends list',
      error: error.message
    });
  }
});

/**
 * DELETE /api/friends/:friendId
 * Remove a friend
 */
router.delete('/:friendId', async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id || req.user._id;
    
    // Delete the friendship
    const result = await Friend.findOneAndDelete({
      $or: [
        { user1: userId, user2: friendId },
        { user1: friendId, user2: userId }
      ]
    });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found'
      });
    }
    
    // Get socket instance
    const io = req.app.get('io');
    
    // Notify the other user about friendship removal
    if (io) {
      io.to(friendId).emit('friendship_removed', {
        userId: userId
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove friend',
      error: error.message
    });
  }
});

/**
 * GET /api/friends/search
 * Search for potential friends (users who are not already friends)
 */
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id || req.user._id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }
    
    // Find current friends
    const friendships = await Friend.find({
      $or: [
        { user1: userId },
        { user2: userId }
      ]
    });
    
    // Extract friend IDs
    const friendIds = friendships.map(friendship => {
      return friendship.user1.toString() === userId.toString() ? 
        friendship.user2 : friendship.user1;
    });
    
    // Add the current user ID to the exclusion list
    const excludeIds = [...friendIds, userId];
    
    // Find users matching the search who are not friends
    const users = await User.find({
      _id: { $nin: excludeIds },
      $or: [
        { firstname: { $regex: query, $options: 'i' } },
        { lastname: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }, 'firstname lastname email').limit(10);
    
    // Also check for pending friend requests
    const sentRequests = await FriendRequest.find({
      sender: userId,
      status: 'pending'
    });
    
    const receivedRequests = await FriendRequest.find({
      recipient: userId,
      status: 'pending'
    });
    
    const sentRequestIds = sentRequests.map(req => req.recipient.toString());
    const receivedRequestIds = receivedRequests.map(req => req.sender.toString());
    
    // Add request status to user objects
    const usersWithStatus = users.map(user => {
      const userObj = user.toObject();
      
      if (sentRequestIds.includes(user._id.toString())) {
        userObj.requestStatus = 'sent';
      } else if (receivedRequestIds.includes(user._id.toString())) {
        userObj.requestStatus = 'received';
      } else {
        userObj.requestStatus = null;
      }
      
      return userObj;
    });
    
    res.status(200).json({
      success: true,
      count: usersWithStatus.length,
      data: usersWithStatus
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
});

module.exports = router;