const express = require("express");
const router = express.Router();
const CalendarEvent = require("../models/CalendarEvent");
const authMiddleware = require("../middleware/authMiddleware");
const { DateTime } = require("luxon");

// existing protected routes
router.use(authMiddleware);

// POST: Create a new event
router.post("/events", authMiddleware, async (req, res) => {
    try {
        const { title, start, end, userId, shared } = req.body;
        
        console.log("Creating new event:", { title, start, end, userId, shared });

        // Store exactly as received without timezone adjustment
        const event = new CalendarEvent({
            title,
            start: new Date(start),
            end: new Date(end),
            userId,
            shared: shared || false
        });

        const saved = await event.save();
        console.log("Event saved successfully:", saved);
        res.status(201).json(saved);
    } catch (err) {
        console.error("Error saving event:", err);
        res.status(500).json({ message: "Could not save event", error: err.message });
    }
});

// IMPORTANT: This specific route must come BEFORE the /:userId route
// GET: Fetch all shared events for the universal calendar
router.get('/events/shared', authMiddleware, async (req, res) => {
    console.log("Fetching shared events for universal calendar");
    try {
        // Fetch all events marked as shared with user information
        const events = await CalendarEvent.find({ shared: true })
            .populate('userId', 'firstname lastname')
            .lean();
        
        console.log(`Found ${events.length} shared events`);
        
        if (!events || !Array.isArray(events)) {
            console.log("No shared events found or invalid response");
            return res.status(200).json([]);
        }
        
        res.status(200).json(events);
    } catch (err) {
        console.error("Error fetching shared events:", err);
        res.status(500).json({ message: "Failed to fetch shared events", error: err.message });
    }
});

// GET: Fetch all events for a user
router.get("/events/:userId", authMiddleware, async (req, res) => {
    console.log(`Fetching events for user ID: ${req.params.userId}`);
    try {
        const events = await CalendarEvent.find({ userId: req.params.userId });
        console.log(`Found ${events.length} events for user ${req.params.userId}`);
        res.json(events);
    } catch (err) {
        console.error(`Error fetching events for user ${req.params.userId}:`, err);
        res.status(500).json({ message: "Could not fetch events", error: err.message });
    }
});

// PUT: Update an existing event
router.put("/events/:id", authMiddleware, async (req, res) => {
    console.log(`Updating event ${req.params.id}:`, req.body);
    try {
        const event = await CalendarEvent.findById(req.params.id);
        if (!event) {
            console.log(`Event ${req.params.id} not found`);
            return res.status(404).json({ message: "Event not found" });
        }

        const updatedEvent = await CalendarEvent.findByIdAndUpdate(
            req.params.id,
            {
                title: req.body.title,
                start: new Date(req.body.start),
                end: new Date(req.body.end),
                shared: req.body.shared !== undefined ? req.body.shared : event.shared
            },
            { new: true }
        );

        console.log("Event updated successfully:", updatedEvent);
        res.json(updatedEvent);
    } catch (err) {
        console.error(`Error updating event ${req.params.id}:`, err);
        res.status(500).json({ message: "Failed to update event", error: err.message });
    }
});

// DELETE: Remove an event
router.delete("/events/:id", authMiddleware, async (req, res) => {
    console.log(`Deleting event ${req.params.id}`);
    try {
        const deleted = await CalendarEvent.findByIdAndDelete(req.params.id);
        if (!deleted) {
            console.log(`Event ${req.params.id} not found for deletion`);
            return res.status(404).json({ message: "Event not found" });
        }

        console.log("Event deleted successfully");
        res.json({ message: "Event deleted" });
    } catch (err) {
        console.error(`Error deleting event ${req.params.id}:`, err);
        res.status(500).json({ message: "Failed to delete event", error: err.message });
    }
});

module.exports = router;