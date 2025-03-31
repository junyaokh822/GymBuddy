const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/messages
 * Send a new message to another user
 */
router.post('/', async (req, res) => {
  try {
    const { recipientId, content } = req.body;
    
    // Validate input
    if (!recipientId || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient and message content are required' 
      });
    }
    
    if (content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }
    
    // Get sender ID from authenticated user
    const senderId = req.user.id || req.user._id;
    
    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }
    
    // Create and save the message
    const newMessage = new Message({
      sender: senderId,
      recipient: recipientId,
      content,
      read: false,
      deletedFor: [] // Initialize empty deletedFor array
    });
    
    await newMessage.save();
    
    // Get the io instance from the app
    const io = req.app.get('io');
    
    // Get sender details
    const sender = await User.findById(senderId);
    const senderName = `${sender.firstname} ${sender.lastname}`;
    
    // Emit real-time message to recipient if they're online
    if (io) {
      io.to(recipientId.toString()).emit('receive_message', {
        _id: newMessage._id,
        sender: senderId,
        senderName: senderName,
        content: content,
        createdAt: newMessage.createdAt,
        read: false
      });
      
      // Also emit a notification for unread messages
      io.to(recipientId.toString()).emit('new_unread_message', {
        count: 1,
        sender: {
          _id: senderId,
          name: senderName
        }
      });
    }
    
    // Return the new message
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

/**
 * GET /api/messages/conversations
 * Get all conversations for the current user
 * IMPORTANT: This route must come before the /:userId route
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    // Find all messages where the user is either sender or recipient
    // AND message is not deleted by current user
    const messages = await Message.find({
      $or: [
        { sender: userId },
        { recipient: userId }
      ],
      deletedFor: { $ne: userId } // Exclude messages deleted by this user
    }).sort({ createdAt: -1 });
    
    // Get unique users the current user has exchanged messages with
    const conversationUserIds = new Set();
    
    messages.forEach(message => {
      if (message.sender.toString() !== userId.toString()) {
        conversationUserIds.add(message.sender.toString());
      }
      if (message.recipient.toString() !== userId.toString()) {
        conversationUserIds.add(message.recipient.toString());
      }
    });
    
    // Fetch user details for each conversation
    const conversationUsers = await User.find({
      _id: { $in: Array.from(conversationUserIds) }
    }, 'firstname lastname email');
    
    // Format conversations with latest message
    const conversations = [];
    const processedUsers = new Set();
    
    for (const message of messages) {
      let otherUserId;
      
      if (message.sender.toString() === userId.toString()) {
        otherUserId = message.recipient.toString();
      } else {
        otherUserId = message.sender.toString();
      }
      
      // Skip if we already added this conversation
      if (processedUsers.has(otherUserId)) {
        continue;
      }
      
      // Find the other user's details
      const otherUser = conversationUsers.find(user => 
        user._id.toString() === otherUserId
      );
      
      if (otherUser) {
        // Count unread messages
        const unreadCount = await Message.countDocuments({
          sender: otherUserId,
          recipient: userId,
          read: false,
          deletedFor: { $ne: userId } // Only count messages not deleted by user
        });
        
        // Add to conversations list
        conversations.push({
          user: {
            _id: otherUser._id,
            firstname: otherUser.firstname,
            lastname: otherUser.lastname,
            email: otherUser.email
          },
          lastMessage: {
            _id: message._id,
            content: message.content,
            createdAt: message.createdAt,
            sender: message.sender.toString() === userId.toString() ? 'me' : 'other'
          },
          unreadCount
        });
        
        processedUsers.add(otherUserId);
      }
    }
    
    res.status(200).json({
      success: true,
      conversations
    });
    
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations',
      error: error.message
    });
  }
});

/**
 * GET /api/messages/unread/count
 * Get count of unread messages
 * IMPORTANT: This route must come before the /:userId route
 */
router.get('/unread/count', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false,
      deletedFor: { $ne: userId } // Don't count messages deleted by user
    });
    
    res.status(200).json({
      success: true,
      unreadCount
    });
    
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread message count',
      error: error.message
    });
  }
});

/**
 * DELETE /api/messages/conversations/:userId
 * Delete entire conversation with a specific user
 * IMPORTANT: This route must come before the /:userId route
 */
router.delete('/conversations/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const otherUserId = req.params.userId;
    
    // Validate the other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Mark all messages in this conversation as deleted for current user
    const result = await Message.updateMany(
      {
        $or: [
          { sender: currentUserId, recipient: otherUserId },
          { sender: otherUserId, recipient: currentUserId }
        ],
        deletedFor: { $ne: currentUserId } // Don't update already deleted messages
      },
      {
        $addToSet: { deletedFor: currentUserId } // Add current user to deletedFor array
      }
    );
    
    // Check if any messages were marked as deleted
    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No messages found to delete'
      });
    }
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
      modifiedCount: result.modifiedCount
    });
    
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
});

/**
 * DELETE /api/messages/:messageId
 * Delete a specific message
 */
router.delete('/:messageId', async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const messageId = req.params.messageId;
    
    // Find the message
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Check if the user is the sender (only sender can delete their messages)
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete messages you sent'
      });
    }
    
    // Store recipient for socket notification
    const recipientId = message.recipient.toString();
    
    // Mark the message as deleted only for the current user
    await Message.findByIdAndUpdate(messageId, 
      { $addToSet: { deletedFor: userId } }
    );
    
    // Notify recipient about message deletion via socket
    const io = req.app.get('io');
    if (io) {
      io.to(recipientId).emit('message_deleted', {
        messageId: messageId
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

/**
 * GET /api/messages/:userId
 * Get conversation with a specific user
 * IMPORTANT: This route should be the last one as it has a generic parameter pattern
 */
router.get('/:userId', async (req, res) => {
  try {
    const currentUserId = req.user.id || req.user._id;
    const otherUserId = req.params.userId;
    
    // Validate the other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get messages between the two users, excluding messages deleted by current user
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: otherUserId },
        { sender: otherUserId, recipient: currentUserId }
      ],
      deletedFor: { $ne: currentUserId } // Don't include messages deleted by current user
    }).sort({ createdAt: 1 });
    
    // Get both user details
    const [currentUser, otherUserDetails] = await Promise.all([
      User.findById(currentUserId, 'firstname lastname'),
      User.findById(otherUserId, 'firstname lastname')
    ]);
    
    // Mark all unread messages as read
    const updateResult = await Message.updateMany(
      { 
        sender: otherUserId, 
        recipient: currentUserId, 
        read: false,
        deletedFor: { $ne: currentUserId } // Only mark non-deleted messages as read
      },
      { read: true }
    );
    
    // If any messages were marked as read, emit socket event
    const io = req.app.get('io');
    if (io && updateResult.modifiedCount > 0) {
      // Let the other user know their messages have been read
      io.to(otherUserId.toString()).emit('messages_read', {
        by: currentUserId,
        conversation: currentUserId
      });
    }
    
    // Format messages with user details
    const formattedMessages = messages.map(message => {
      const isSender = message.sender.toString() === currentUserId.toString();
      return {
        _id: message._id,
        content: message.content,
        createdAt: message.createdAt,
        sender: isSender ? 'me' : 'other',
        senderName: isSender ? 
          `${currentUser.firstname} ${currentUser.lastname}` : 
          `${otherUserDetails.firstname} ${otherUserDetails.lastname}`,
        read: message.read
      };
    });
    
    res.status(200).json({
      success: true,
      otherUser: {
        _id: otherUserDetails._id,
        firstname: otherUserDetails.firstname,
        lastname: otherUserDetails.lastname
      },
      messages: formattedMessages
    });
    
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation',
      error: error.message
    });
  }
});

module.exports = router;