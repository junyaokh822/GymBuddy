const mongoose = require('mongoose');

const FriendRequestSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Create a compound index to ensure unique requests
// and to make lookups efficient
FriendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('FriendRequest', FriendRequestSchema);