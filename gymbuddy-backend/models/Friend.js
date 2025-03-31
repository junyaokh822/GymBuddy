const mongoose = require('mongoose');

const FriendSchema = new mongoose.Schema({
  user1: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  user2: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Track which users have deleted this friendship
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Create a compound index to ensure unique friendships
// and to make lookups efficient
FriendSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model('Friend', FriendSchema);