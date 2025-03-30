const mongoose = require("mongoose");

const CalendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shared: { type: Boolean, default: false }
});

module.exports = mongoose.model("CalendarEvent", CalendarEventSchema);