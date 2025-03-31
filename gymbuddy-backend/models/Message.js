const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
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
  content: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 1000 
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  // Track which users have deleted this message
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Create index for efficient querying of conversations
MessageSchema.index({ sender: 1, recipient: 1 });
MessageSchema.index({ createdAt: -1 });
// Add index for the new deletedFor field for faster filtering
MessageSchema.index({ deletedFor: 1 });

module.exports = mongoose.model('Message', MessageSchema);