const express = require("express");
const router = express.Router();
const CalendarEvent = require("../models/CalendarEvent");
const authMiddleware = require("../middleware/authMiddleware");
const { DateTime } = require("luxon");



router.post("/events", authMiddleware, async (req, res) => {
    try {
        const { title, start, end, userId } = req.body;

        // Store exactly as received without timezone adjustment
        const event = new CalendarEvent({
            title,
            start: new Date(start),
            end: new Date(end),
            userId,
        });

        const saved = await event.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ message: "Could not save event", error: err.message });
    }
});

// GET: Fetch all events for a user
router.get("/events/:userId", authMiddleware, async (req, res) => {
    try {
        const events = await CalendarEvent.find({ userId: req.params.userId });
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: "Could not fetch events", error: err.message });
    }
});

router.put("/events/:id", authMiddleware, async (req, res) => {
    try {
        const updatedEvent = await CalendarEvent.findByIdAndUpdate(
            req.params.id,
            {
                title: req.body.title,
                start: new Date(req.body.start),
                end: new Date(req.body.end)
            },
            { new: true }
        );

        if (!updatedEvent) {
            return res.status(404).json({ message: "Event not found" });
        }

        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ message: "Failed to update event", error: err.message });
    }
});

router.delete("/events/:id", authMiddleware, async (req, res) => {
    try {
        const deleted = await CalendarEvent.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Event not found" });

        res.json({ message: "Event deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete event", error: err.message });
    }
});


module.exports = router;
