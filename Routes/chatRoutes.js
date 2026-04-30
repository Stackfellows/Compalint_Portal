import express from 'express';
import Groq from 'groq-sdk';
import Chat from '../Models/Chat.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @desc    Get AI Response
// @route   POST /api/chat/ask
router.post('/ask', async (req, res, next) => {
    try {
        const { message, sessionId, userId } = req.body;

        if (!message) {
            res.status(400);
            throw new Error('Please provide a message');
        }

        // Find or create chat session
        let chat = await Chat.findOne({ sessionId });
        if (!chat) {
            chat = await Chat.create({ sessionId, userId, messages: [
                { 
                    role: 'system', 
                    content: `You are the Official AI Assistant for the Hunarmand Punjab Complaint Portal. 
                    
                    Here is the essential information about the portal to help users:
                    1. LOGIN/SIGNUP: Users can create an account by clicking "Sign Up" on the login page. They need to provide their Name, Email, Roll Number, and Password.
                    2. CREATING A COMPLAINT: After logging in, students should go to "Create Complaint" from the sidebar. They must select a Department (Technical or Support), a Category (like LMS, Challan, Scholarship), add a Subject, and a detailed Description.
                    3. ATTACHMENTS: Students can upload up to 5 documents or images with their complaint to provide proof.
                    4. TRACKING: Once submitted, students can track their ticket status (Open, In Progress, Resolved, Closed) in the "My Tickets" section.
                    5. DEPARTMENTS: 
                       - Technical Department: Handles portal errors, LMS access issues, and form errors.
                       - Support Department: Handles LMS content, courses, challans, and general queries.
                    6. MESSAGING: Students can chat with staff members directly inside their ticket view until the ticket is "Closed". Once "Closed", they cannot send more messages.
                    
                    Always be professional, polite, and guide the student step-by-step.` 
                }
            ] });
        }

        // Add user message
        chat.messages.push({ role: 'user', content: message });

        // Get AI completion
        const completion = await groq.chat.completions.create({
            messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
            model: "llama-3.3-70b-versatile",
        });

        const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";

        // Add assistant response
        chat.messages.push({ role: 'assistant', content: aiResponse });
        await chat.save();

        res.json({
            success: true,
            response: aiResponse,
            chatId: chat._id
        });
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        next(error);
    }
});

export default router;
