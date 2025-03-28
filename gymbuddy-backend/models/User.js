const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    preferences: {
        type: [String],
        default: []
      },
    // 🔐 Password reset fields
    resetToken: { type: String },
    resetTokenExpiration: { type: Date }

}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
